import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

vi.mock("#services/mail/portfolioMail", () => ({
  sendPortfolioUpdatedEmail: vi.fn().mockResolvedValue(undefined),
}));

function asUser(user: TestUser, req: request.Test) {
  return req.set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie);
}

const CUSTOM_SEO = {
  title: "Hire me for distributed systems",
  description: "Ten years of backend work.",
  socialImage: null,
};

async function draftWithSeo(userId: string) {
  return prisma.document.create({
    data: {
      userId,
      type: "PORTFOLIO",
      title: "Portfolio",
      slug: `seo-${randomUUID().slice(0, 8)}`,
      templateId: "signal",
      content: {
        schemaVersion: 1,
        templateId: "signal",
        identity: {
          name: "Test Person",
          headline: "Builds things",
          bio: "A bio long enough to publish.",
          location: "Somewhere",
          email: "person@example.test",
          availability: "Open",
          avatar: null,
        },
        seo: CUSTOM_SEO,
        socialLinks: [],
        sections: [{ id: "projects", type: "projects", title: "Work", visible: true, items: [] }],
      },
    },
  });
}

async function grant(userId: string, key: string) {
  await prisma.entitlementGrant.create({
    data: { userId, key, source: "MANUAL", sourceId: randomUUID() },
  });
}

async function publish(user: TestUser) {
  const document = await draftWithSeo(user.id);
  const response = await asUser(user, request(app).post("/api/v1/portfolios/publish")).send({
    documentId: document.id,
    subdomain: document.slug,
    revision: document.revision,
  });
  expect(response.status).toBe(201);
  const publication = await prisma.portfolioPublication.findUniqueOrThrow({
    where: { userId: user.id },
  });
  return { document, snapshot: publication.snapshot as { seo: typeof CUSTOM_SEO } };
}

/** V-142: `seo_controls` was sold but never checked; a free account's SEO block went live. */
describe("seo_controls at publish", () => {
  it("publishes a free account's portfolio with the default SEO, keeping the draft's", async () => {
    const user = await createUserWithSession();
    const { document, snapshot } = await publish(user);

    expect(snapshot.seo).toEqual({ title: "", description: "", socialImage: null });
    const draft = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect((draft.content as { seo: unknown }).seo).toEqual(CUSTOM_SEO);
  });

  it("keeps the SEO block for an account holding seo_controls", async () => {
    const user = await createUserWithSession();
    await grant(user.id, "seo_controls");

    const { snapshot } = await publish(user);

    expect(snapshot.seo).toEqual(CUSTOM_SEO);
  });
});

/** V-142: analytics is gated on its own entitlement, not on the publish grant. */
describe("analytics entitlement", () => {
  it("is locked without the analytics grant and open with it", async () => {
    const publisher = await createUserWithSession();
    await grant(publisher.id, "portfolio_publish");
    const analyst = await createUserWithSession();
    await grant(analyst.id, "analytics");

    const locked = await asUser(publisher, request(app).get("/api/v1/portfolios/analytics"));
    expect(locked.status).toBe(200);
    expect(locked.body.data.locked).toBe(true);

    const open = await asUser(analyst, request(app).get("/api/v1/portfolios/analytics"));
    expect(open.status).toBe(200);
    expect(open.body.data.locked).toBe(false);
  });
});

/** V-162 against the real router: unmatched paths share one key, real routes keep theirs. */
describe("rate limiter keys", () => {
  it("keys an unmatched path as `unmatched` and a real route by its path", async () => {
    const redis = getRedis();
    await redis.flushDb();

    const junk = `/api/v1/${randomUUID()}/${"a".repeat(500)}`;
    expect((await request(app).get(junk).set("Origin", STUDIO_ORIGIN)).status).toBe(404);
    expect((await request(app).get("/no-such-page.php")).status).toBe(404);
    await request(app).get("/api/v1/roadmap").set("Origin", STUDIO_ORIGIN);

    const keys = await redis.keys("rate-limit:*");
    const unmatched = keys.filter((key) => key.startsWith("rate-limit:unmatched:"));
    expect(unmatched).toHaveLength(1);
    expect(await redis.get(unmatched[0]!)).toBe("2");
    expect(keys.some((key) => key.includes("aaaaaaaa"))).toBe(false);
    expect(keys.some((key) => key.startsWith("rate-limit:GET:/api/v1/roadmap:"))).toBe(true);
  });
});
