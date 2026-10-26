import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { PURGED_DOCUMENT_CONTENT } from "#jobs/retentionJob";
import { EntitlementService } from "#services/entitlementService";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function asUser(user: TestUser) {
  return {
    get: (url: string) =>
      request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    post: (url: string) =>
      request(app).post(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    delete: (url: string) =>
      request(app).delete(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  };
}

/** A one-time Job Hunter pass, as `applyPaymentEvent` writes it. */
async function grantPass(userId: string) {
  const sourceId = `pay_${randomUUID()}`;
  for (const key of ["ai_credits", "portfolio_publish"])
    await prisma.entitlementGrant.create({
      data: {
        userId,
        key,
        source: "SYSTEM",
        sourceId,
        endsAt: new Date(Date.now() + 7 * DAY_MS),
        metadata: { productKey: "bundle", interval: "seven_day", pass: true },
      },
    });
}

/** A 250-credit pack: credits in the wallet, no entitlement. */
async function buyPack(userId: string) {
  const wallet = await prisma.creditWallet.create({
    data: { userId, balance: 250, lifetimeCredited: 250 },
  });
  await prisma.creditGrant.create({
    data: {
      walletId: wallet.id,
      userId,
      amount: 250,
      remaining: 250,
      // The source a real pack purchase writes (CREDIT_SOURCES.creditPack).
      source: "credit_pack",
      sourceId: `pay_${randomUUID()}`,
      expiresAt: new Date(Date.now() + 90 * DAY_MS),
    },
  });
}

describe("one isPaid for documents and imports (V-173, owner decision 3)", () => {
  it("a pass unlocks unlimited documents and imports", async () => {
    const user = await createUserWithSession();
    await grantPass(user.id);
    const api = asUser(user);

    expect(await EntitlementService.isPaid(user.id)).toBe(true);
    expect((await api.post("/api/v1/documents").send({ type: "RESUME" })).status).toBe(201);
    expect((await api.post("/api/v1/documents").send({ type: "RESUME" })).status).toBe(201);

    const quota = await api.get("/api/v1/profiles/import/quota");
    expect(quota.body.data.linkedin.isPaid).toBe(true);
  });

  it("a credit pack is AI fuel only: the free document limit and import quota still apply", async () => {
    const user = await createUserWithSession();
    await buyPack(user.id);
    const api = asUser(user);

    expect(await EntitlementService.isPaid(user.id)).toBe(false);
    expect((await api.post("/api/v1/documents").send({ type: "RESUME" })).status).toBe(201);

    const second = await api.post("/api/v1/documents").send({ type: "RESUME" });
    expect(second.status).toBe(402);
    expect(second.body.message).toBe(
      "Free accounts can keep 1 active resume at a time. Unlimited documents come with any plan (AI Credits, Creator Pro or the Job Hunter Bundle) or a pass; credit packs add AI credits only.",
    );

    const quota = await api.get("/api/v1/profiles/import/quota");
    expect(quota.body.data.linkedin.isPaid).toBe(false);
  });

  it("names the right products when the free import quota is spent", async () => {
    const user = await createUserWithSession();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastGithubImportAt: new Date() },
    });

    const response = await asUser(user)
      .post("/api/v1/profiles/import/github")
      .send({ usernameOrUrl: "octocat", replaceMaster: false });

    expect(response.status).toBe(429);
    expect(response.body.message).toBe(
      "Free accounts can import from GitHub once a day. Unlimited imports come with any plan (AI Credits, Creator Pro or the Job Hunter Bundle) or a pass.",
    );
  });
});

describe("profile document count (V-186)", () => {
  it("counts only the documents the user sees: no deleted, purged or portfolio rows", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);
    const base = { userId: user.id, content: { basics: { name: "Count" } } };

    await prisma.document.createMany({
      data: [
        { ...base, slug: "resume", type: "RESUME" },
        { ...base, slug: "letter", type: "COVER_LETTER" },
        { ...base, slug: "site", type: "PORTFOLIO" },
        { ...base, slug: "binned", type: "RESUME", deletedAt: new Date() },
        {
          ...base,
          slug: "purged",
          type: "RESUME",
          deletedAt: new Date(Date.now() - 40 * DAY_MS),
          content: PURGED_DOCUMENT_CONTENT,
        },
      ],
    });

    const me = await api.get("/api/v1/users/me");
    expect(me.status).toBe(200);
    expect(me.body.data._count.resumes).toBe(2);

    // A deletion shows up straight away, not after the 30-minute profile cache.
    const resume = await prisma.document.findFirstOrThrow({
      where: { userId: user.id, slug: "resume" },
    });
    expect((await api.delete(`/api/v1/documents/${resume.id}`)).status).toBe(200);
    expect((await api.get("/api/v1/users/me")).body.data._count.resumes).toBe(1);
  });
});

/** An entitlement as a live AI Credits subscription (or an admin comp) writes it. */
async function grantKey(
  userId: string,
  key: "ai_credits" | "portfolio_publish",
  source: "SUBSCRIPTION" | "MANUAL",
) {
  await prisma.entitlementGrant.create({
    data: {
      userId,
      key,
      source,
      sourceId: source === "SUBSCRIPTION" ? `sub_${randomUUID()}` : randomUUID(),
      endsAt: new Date(Date.now() + 30 * DAY_MS),
      metadata: source === "SUBSCRIPTION" ? { productKey: "ai_credits" } : undefined,
    },
  });
}

async function billingAccess(user: TestUser) {
  const response = await asUser(user).get("/api/v1/billing/me");
  expect(response.status).toBe(200);
  return response.body.data.access;
}

describe("two notions of paid, kept apart (V-173, V-174, V-189, owner decision 2)", () => {
  it("(a) has Pro: an AI Credits subscription lifts the document limit and the import quota", async () => {
    const user = await createUserWithSession();
    await grantKey(user.id, "ai_credits", "SUBSCRIPTION");
    const api = asUser(user);

    expect(await EntitlementService.isPaid(user.id)).toBe(true);
    expect((await api.post("/api/v1/documents").send({ type: "RESUME" })).status).toBe(201);
    expect((await api.post("/api/v1/documents").send({ type: "RESUME" })).status).toBe(201);
    expect((await api.get("/api/v1/profiles/import/quota")).body.data.linkedin.isPaid).toBe(true);
  });

  it("(b) the public portfolio's paid features follow the portfolio entitlement, not AI Credits", async () => {
    async function publishedSignal(keys: Array<"ai_credits" | "portfolio_publish">) {
      const user = await createUserWithSession();
      for (const key of keys) await grantKey(user.id, key, "SUBSCRIPTION");
      const subdomain = `paid-${randomUUID().slice(0, 8)}`;
      const content = { schemaVersion: 1, templateId: "signal" };
      const document = await prisma.document.create({
        data: { userId: user.id, type: "PORTFOLIO", title: "Site", slug: subdomain, content },
      });
      await prisma.portfolioPublication.create({
        data: {
          userId: user.id,
          documentId: document.id,
          subdomain,
          templateId: "signal",
          snapshot: content,
          status: "LIVE",
        },
      });
      const response = await request(app)
        .get(`/api/v1/portfolios/public/${subdomain}`)
        .set("Origin", STUDIO_ORIGIN);
      expect(response.status).toBe(200);
      return response.body.data;
    }

    // Badge, subdomain redirect and sub-pages are Creator Pro features: AI Credits is not one.
    expect((await publishedSignal(["ai_credits"])).isPaid).toBe(false);
    expect((await publishedSignal(["portfolio_publish"])).isPaid).toBe(true);
    expect((await publishedSignal(["ai_credits", "portfolio_publish"])).isPaid).toBe(true);
  });

  it("(c) paying: an admin comp and goodwill credits do not make someone paying; a pass does", async () => {
    const comped = await createUserWithSession();
    await grantKey(comped.id, "ai_credits", "MANUAL");
    await grantKey(comped.id, "portfolio_publish", "MANUAL");
    expect(await billingAccess(comped)).toMatchObject({ isPaying: false, isPaid: true });

    const free = await createUserWithSession();
    expect(await billingAccess(free)).toMatchObject({
      tier: "free",
      isPaying: false,
      isPaid: false,
    });

    const pass = await createUserWithSession();
    await grantPass(pass.id);
    expect(await billingAccess(pass)).toMatchObject({ tier: "pass", isPaying: true, isPaid: true });

    const pack = await createUserWithSession();
    await buyPack(pack.id);
    expect(await billingAccess(pack)).toMatchObject({
      tier: "credits",
      isPaying: true,
      isPaid: false,
    });

    const subscriber = await createUserWithSession();
    await grantKey(subscriber.id, "ai_credits", "SUBSCRIPTION");
    expect(await billingAccess(subscriber)).toMatchObject({
      tier: "ai_credits",
      isPaying: true,
      isPaid: true,
    });
  });
});
