import request from "supertest";
import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

// The mail transport is the one thing replaced here: the contact receipt is asserted on what would
// have been handed to Resend/SMTP, with everything above it (route, limiter, Redis) real.
vi.mock("#services/mail/transporter", () => ({ sendMail }));

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";
import { ShareService } from "#services/shareService";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession } from "./helpers/auth.js";

const PASSWORD = "correct horse battery staple";

/**
 * Letters only by default: the middleware folds segments that mix letters and digits into `:id`,
 * which puts every such link into one outer bucket per IP. `idLike` asks for exactly that.
 */
async function seedProtectedShare({ idLike = false } = {}) {
  const letters = Array.from(randomBytes(6), (b) => String.fromCharCode(97 + (b % 26))).join("");
  const suffix = idLike ? `${letters}42` : letters;
  const user = await createUserWithSession({ username: `owner${suffix}` });
  const slug = `resume-${suffix}`;

  const document = await prisma.document.create({
    data: { userId: user.id, title: "Resume", slug, content: { basics: { name: "Owner" } } },
  });

  const shareLink = await prisma.shareLink.create({
    data: {
      userId: user.id,
      documentId: document.id,
      slug,
      snapshot: { basics: { name: "Owner" } },
      passwordHash: await ShareService.hashPassword(PASSWORD),
    },
  });

  return { username: `owner${suffix}`, slug, shareLinkId: shareLink.id };
}

function verify(path: string, body: object) {
  return request(app).post(path).set("Origin", STUDIO_ORIGIN).send(body);
}

async function innerAttemptCount(shareLinkId: string): Promise<number | null> {
  const keys = await getRedis().keys(`share:verify-attempts:${shareLinkId}:*`);
  if (keys.length === 0) return null;
  return Number(await getRedis().get(keys[0]!));
}

describe("share password verify", () => {
  /**
   * V-128: the studio treats every 401 as an expired session and signs the viewer out, so a typo
   * in a share password must not be a 401.
   */
  it("answers a wrong password with 403 and a missing password with 400", async () => {
    const { username, slug } = await seedProtectedShare();
    const path = `/api/v1/shares/public/${username}/${slug}/verify`;

    const wrong = await verify(path, { password: "nope" });
    expect(wrong.status).toBe(403);
    expect(wrong.body).toMatchObject({
      success: false,
      message: "Invalid password",
      statusCode: 403,
    });

    const missing = await verify(path, {});
    expect(missing.status).toBe(400);
  });

  /**
   * The per-link limit lives in the handler and is keyed on the link, so path spellings that
   * normalise to the same link (`slug`, `slug-`, `-slug` all resolve to one share) cannot each
   * get their own budget the way they do in the path-keyed middleware.
   */
  it("refuses the 6th wrong attempt per link and IP with 429 and Retry-After, across spellings", async () => {
    const { username, slug } = await seedProtectedShare();
    const spellings = [slug, `${slug}-`, `-${slug}`];
    const statuses: number[] = [];
    let last: request.Response | undefined;

    for (let i = 0; i < 6; i += 1) {
      const spelling = spellings[Math.floor(i / 2)]!;
      last = await verify(`/api/v1/shares/public/${username}/${spelling}/verify`, {
        password: `wrong-${i}`,
      });
      statuses.push(last.status);
    }

    expect(statuses).toEqual([403, 403, 403, 403, 403, 429]);
    expect(Number(last!.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(last!.headers["retry-after"])).toBeLessThanOrEqual(300);
  });

  /** V-087: `/SHARES/PUBLIC/…/VERIFY/` used to land in its own bucket under the 100/15 min default. */
  it("counts the upper-case, trailing-slash spelling in the same limiter bucket", async () => {
    const { username, slug, shareLinkId } = await seedProtectedShare();

    const lower = `/api/v1/shares/public/${username}/${slug}/verify`;
    const shoutedPath = `/api/v1/SHARES/PUBLIC/${username.toUpperCase()}/${slug.toUpperCase()}/VERIFY/`;

    for (const [i, path] of [lower, lower, lower, shoutedPath, shoutedPath].entries()) {
      const res = await verify(path, { password: `wrong-${i}` });
      expect(res.status).toBe(403);
    }

    // Both spellings drew on one per-link counter and one middleware bucket.
    expect(await innerAttemptCount(shareLinkId)).toBe(5);
    expect(await getRedis().get(`rate-limit:POST:${lower}:127.0.0.1`)).toBe("5");

    const shouted = await verify(shoutedPath, { password: "wrong-again" });
    expect(shouted.status).toBe(429);
    expect(Number(shouted.headers["retry-after"])).toBeGreaterThan(0);
  });

  /**
   * The middleware class (20 / 5 min per IP, shared across links whose segments fold to `:id`)
   * is only the outer bound: a viewer can use the full 5-attempt budget on two links.
   */
  it("gives each link its own 5 attempts under the shared outer bound", async () => {
    const a = await seedProtectedShare({ idLike: true });
    const b = await seedProtectedShare({ idLike: true });
    const pathOf = (s: { username: string; slug: string }) =>
      `/api/v1/shares/public/${s.username}/${s.slug}/verify`;

    for (const link of [a, b])
      for (let i = 0; i < 5; i += 1)
        expect((await verify(pathOf(link), { password: `wrong-${i}` })).status).toBe(403);

    // All ten landed in one outer bucket, which is still under its ceiling.
    expect(
      await getRedis().get("rate-limit:POST:/api/v1/shares/public/:id/:id/verify:127.0.0.1"),
    ).toBe("10");

    for (const link of [a, b]) {
      const sixth = await verify(pathOf(link), { password: "wrong-6" });
      expect(sixth.status).toBe(429);
      expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
    }
  });

  it("unlocks with the correct password and resets the per-link counter", async () => {
    const { username, slug, shareLinkId } = await seedProtectedShare();
    const path = `/api/v1/shares/public/${username}/${slug}/verify`;

    expect((await verify(path, { password: "wrong-1" })).status).toBe(403);
    expect(await innerAttemptCount(shareLinkId)).toBe(1);

    const unlocked = await verify(path, { password: PASSWORD });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data.snapshot).toEqual({ basics: { name: "Owner" } });

    expect(await innerAttemptCount(shareLinkId)).toBeNull();
  });
});

describe("contact form", () => {
  const MESSAGE = "Visit https://evil.example/claim-your-prize to collect your reward now";
  const SUBJECT = "You won a prize";

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
  });

  function submit(path: string, overrides: Record<string, unknown> = {}) {
    return request(app)
      .post(path)
      .set("Origin", STUDIO_ORIGIN)
      .send({
        name: "Mallory <b>Attacker</b> With A Very Long Name That Keeps Going",
        email: "victim@example.test",
        subject: SUBJECT,
        message: MESSAGE,
        _ts: Date.now() - 5_000,
        ...overrides,
      });
  }

  it("rejects, throttles receipts per recipient, and never echoes content to the recipient", async () => {
    // 1. No `_ts`: a hard 400, not a silent success.
    const missingTs = await submit("/api/v1/contact", { _ts: undefined });
    expect(missingTs.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();

    // 2. A valid submission: the team gets the content, the submitter gets a fixed receipt.
    const ok = await submit("/api/v1/contact");
    expect(ok.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(2);

    const [adminMail, receipt] = sendMail.mock.calls.map(([mail]) => mail);
    expect(adminMail.to).not.toBe("victim@example.test");
    expect(adminMail.text).toContain(MESSAGE);

    expect(receipt.to).toBe("victim@example.test");
    for (const field of [receipt.subject, receipt.text, receipt.html]) {
      expect(field).not.toContain("evil.example");
      expect(field).not.toContain(SUBJECT);
      expect(field).not.toContain("<b>");
      expect(field).not.toContain("Keeps Going");
    }

    // 3. Receipts are capped at 3 per recipient per day; the team notification still goes out.
    expect((await submit("/api/v1/contact")).status).toBe(200);
    expect((await submit("/api/v1/contact")).status).toBe(200);
    const receiptsSoFar = sendMail.mock.calls.filter(([m]) => m.to === "victim@example.test");
    expect(receiptsSoFar).toHaveLength(3);

    sendMail.mockClear();
    expect((await submit("/api/v1/contact")).status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]![0].to).not.toBe("victim@example.test");

    // 4. That was the 5th request this hour from this IP; a differently-spelled path is the same
    //    bucket and is refused.
    const sixth = await submit("/api/v1/Contact/");
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("OTP recipient cap through better-auth", () => {
  const recipientKey = (email: string) =>
    `auth:otp:recipient:${createHash("sha256").update(email).digest("hex")}`;

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
  });

  function auth(path: string, body: object) {
    return request(app).post(`/api/v1/auth${path}`).set("Origin", STUDIO_ORIGIN).send(body);
  }

  /**
   * Reset codes only go to existing accounts, so a 429 here would say the account exists. Past the
   * cap both a registered and an unknown address get the same 200; the registered one gets no mail.
   */
  it("answers a capped password reset with a uniform 200 and sends nothing", async () => {
    const registered = await createUserWithSession({ email: "reset-owner@example.test" });
    const unknown = "nobody-here@example.test";

    for (const email of [registered.email, unknown]) await getRedis().set(recipientKey(email), "5");

    for (const [path, email] of [
      ["/email-otp/request-password-reset", registered.email],
      ["/email-otp/request-password-reset", unknown],
      ["/forget-password/email-otp", registered.email],
      ["/forget-password/email-otp", unknown],
    ] as const) {
      const res = await auth(path, { email });
      expect(res.status, `${path} ${email}`).toBe(200);
    }

    expect(sendMail).not.toHaveBeenCalled();
    // The registered address was counted (and refused) inside sendVerificationOTP; the unknown
    // one never reached it.
    expect(await getRedis().get(recipientKey(registered.email))).toBe("7");
    expect(await getRedis().get(recipientKey(unknown))).toBe("5");
  });

  it("answers a capped sign-in code request with 429, since sign-in mails any address", async () => {
    const email = "signin-target@example.test";
    await getRedis().set(recipientKey(email), "5");

    const res = await auth("/email-otp/send-verification-otp", { email, type: "sign-in" });
    expect(res.status).toBe(429);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("share link list (V-030)", () => {
  const list = (cookie: string, documentId: string, query = "") =>
    request(app)
      .get(`/api/v1/shares/documents/${documentId}${query}`)
      .set("Origin", STUDIO_ORIGIN)
      .set("Cookie", cookie);

  async function seedShared() {
    const user = await createUserWithSession();
    const document = await prisma.document.create({
      data: { userId: user.id, title: "Resume", slug: "resume", content: {} },
    });
    await prisma.shareLink.create({
      data: { userId: user.id, documentId: document.id, slug: "resume", snapshot: {} },
    });
    return { user, documentId: document.id };
  }

  it("pages for real: a page past the end is empty and the total is the real count", async () => {
    const { user, documentId } = await seedShared();

    const first = await list(user.cookie, documentId, "?page=1&pageSize=20");
    expect(first.status).toBe(200);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data).toMatchObject({ total: 1, hasMore: false });

    const second = await list(user.cookie, documentId, "?page=2&pageSize=20");
    expect(second.status).toBe(200);
    expect(second.body.data.items).toEqual([]);
    expect(second.body.data.total).toBe(1);
  });

  it("an account without a username can open an empty list", async () => {
    const user = await createUserWithSession();
    await prisma.user.update({ where: { id: user.id }, data: { username: null } });
    const document = await prisma.document.create({
      data: { userId: user.id, title: "Resume", slug: "resume", content: {} },
    });

    const response = await list(user.cookie, document.id);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ items: [], total: 0 });
  });

  it("leaves out links on a soft-deleted document, even after the list was cached", async () => {
    const { user, documentId } = await seedShared();

    expect((await list(user.cookie, documentId)).body.data.total).toBe(1);

    const deleted = await request(app)
      .delete(`/api/v1/documents/${documentId}`)
      .set("Origin", STUDIO_ORIGIN)
      .set("Cookie", user.cookie);
    expect(deleted.status).toBe(200);

    const after = await list(user.cookie, documentId);
    expect(after.body.data).toMatchObject({ items: [], total: 0 });
  });
});
