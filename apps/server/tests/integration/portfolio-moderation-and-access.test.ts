import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { suspendExpiredGracePeriods } from "#jobs/portfolioAccessJob";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";
import { signDodoWebhook } from "./helpers/webhook.js";

const { mailMock } = vi.hoisted(() => ({
  mailMock: {
    sendSubscriptionPurchasedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue(undefined),
    sendPortfolioUpdatedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("#services/mail/billingMail", () => mailMock);
vi.mock("#services/mail/portfolioMail", () => mailMock);

const WEBHOOK_PATH = "/api/v1/billing/webhooks/dodo";
const DAY_MS = 24 * 60 * 60 * 1000;

let adminPromise: Promise<TestUser> | null = null;
function admin() {
  return (adminPromise ??= createUserWithSession({ email: "admin@example.test" }));
}

function asUser(user: TestUser, req: request.Test) {
  return req.set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie);
}

/** Public routes sit behind `flexibleAuth`, which wants a first-party Origin even without a session. */
function publicGet(path: string) {
  return request(app).get(path).set("Origin", STUDIO_ORIGIN);
}

function validContent(templateId: "signal" | "atelier" | "nimbus" | "cipher") {
  return {
    schemaVersion: 1,
    templateId,
    identity: {
      name: "Test Person",
      headline: "Builds things",
      bio: "A bio long enough to publish.",
      location: "Somewhere",
      email: "person@example.test",
      availability: "Open",
      avatar: null,
    },
    seo: { title: "Test Person", description: "Portfolio", socialImage: null },
    socialLinks: [],
    sections: [{ id: "projects", type: "projects", title: "Work", visible: true, items: [] }],
  };
}

async function seedPublication(
  userId: string,
  templateId: "signal" | "atelier" | "nimbus" | "cipher",
  overrides: {
    status?: "LIVE" | "GRACE" | "SUSPENDED";
    suspensionReason?: string | null;
    subdomain?: string;
  } = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const subdomain = overrides.subdomain ?? `pub-${suffix}`;
  const document = await prisma.document.create({
    data: {
      userId,
      type: "PORTFOLIO",
      title: "Portfolio",
      slug: subdomain,
      templateId,
      content: validContent(templateId),
      visibility: "PUBLIC",
    },
  });
  const publication = await prisma.portfolioPublication.create({
    data: {
      userId,
      documentId: document.id,
      subdomain,
      templateId,
      snapshot: validContent(templateId),
      status: overrides.status ?? "LIVE",
      suspensionReason: overrides.suspensionReason ?? null,
      suspendedAt: overrides.status === "SUSPENDED" ? new Date() : null,
    },
  });
  return { document, publication };
}

async function publicationOf(userId: string) {
  return prisma.portfolioPublication.findUniqueOrThrow({ where: { userId } });
}

function subscriptionEvent(input: {
  userId: string;
  subscriptionId: string;
  productId?: string;
  status: "active" | "cancelled" | "on_hold" | "expired";
  at?: Date;
  nextBillingDate?: Date | null;
}) {
  const at = input.at ?? new Date(Date.now() - 60_000);
  return {
    type: `subscription.${input.status}`,
    timestamp: at.toISOString(),
    data: {
      subscription_id: input.subscriptionId,
      customer: { customer_id: "cus_portfolio" },
      product_id: input.productId ?? "prod_portfolio_pro_monthly",
      status: input.status,
      cancel_at_next_billing_date: false,
      next_billing_date:
        input.nextBillingDate === undefined
          ? new Date(Date.now() + 30 * DAY_MS).toISOString()
          : input.nextBillingDate
            ? input.nextBillingDate.toISOString()
            : null,
      metadata: { veriworkly_user_id: input.userId },
    },
  };
}

async function deliver(event: unknown) {
  const body = JSON.stringify(event);
  const headers = signDodoWebhook(body);
  const req = request(app).post(WEBHOOK_PATH);
  for (const [key, value] of Object.entries(headers)) req.set(key, value);
  const response = await req.send(body);
  expect(response.status).toBe(200);
  return response;
}

async function adminSuspend(publicationId: string) {
  const response = await asUser(
    await admin(),
    request(app).patch(`/api/v1/admin/portfolios/${publicationId}`),
  ).send({ status: "SUSPENDED", reason: "Impersonation reported by the trademark owner" });
  expect(response.status).toBe(200);
  return response;
}

describe("V-039 sticky moderation", () => {
  it("refuses the user's Publish with 403 and keeps the row SUSPENDED", async () => {
    const user = await createUserWithSession();
    const { document, publication } = await seedPublication(user.id, "signal");

    await adminSuspend(publication.id);

    const publish = await asUser(user, request(app).post("/api/v1/portfolios/publish")).send({
      documentId: document.id,
      subdomain: publication.subdomain,
      revision: document.revision,
    });

    expect(publish.status).toBe(403);
    expect(publish.body.message ?? publish.body.error).toMatch(/taken down by a moderator/i);

    const row = await publicationOf(user.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toMatch(/^moderation:/);
  });

  it("survives a renewal webhook", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "nimbus");

    await adminSuspend(publication.id);
    await deliver(
      subscriptionEvent({
        userId: user.id,
        subscriptionId: `sub_${randomUUID()}`,
        status: "active",
      }),
    );

    const row = await publicationOf(user.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toMatch(/^moderation:/);
  });

  it("is not cleared by the user's own unpublish", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "signal");

    await adminSuspend(publication.id);

    const unpublish = await asUser(user, request(app).post("/api/v1/portfolios/unpublish")).send();
    expect(unpublish.status).toBe(200);

    const row = await publicationOf(user.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toMatch(/^moderation:/);
  });

  it("is lifted by the admin setting LIVE, after which the user can publish again", async () => {
    const user = await createUserWithSession();
    const { document, publication } = await seedPublication(user.id, "signal");

    await adminSuspend(publication.id);

    const lift = await asUser(
      await admin(),
      request(app).patch(`/api/v1/admin/portfolios/${publication.id}`),
    ).send({ status: "LIVE", reason: "Counter-notice accepted" });
    expect(lift.status).toBe(200);

    const publish = await asUser(user, request(app).post("/api/v1/portfolios/publish")).send({
      documentId: document.id,
      subdomain: publication.subdomain,
      revision: document.revision,
    });
    expect(publish.status).toBe(201);
    expect((await publicationOf(user.id)).status).toBe("LIVE");
  });
});

describe("V-041 section schema", () => {
  it("saves a draft with a certifications section carrying subtitle and settings, and round-trips them", async () => {
    const user = await createUserWithSession();
    const content = {
      ...validContent("signal"),
      sections: [
        {
          id: "certs",
          type: "certifications",
          title: "Certifications",
          subtitle: "Verified credentials",
          visible: true,
          items: [{ name: "AWS SAA" }],
          settings: { layout: "grid", columns: 2 },
        },
      ],
    };

    const save = await asUser(user, request(app).put("/api/v1/portfolios/draft")).send({
      subdomain: `draft-${randomUUID().slice(0, 8)}`,
      snapshot: content,
    });
    expect(save.status).toBe(200);

    const me = await asUser(user, request(app).get("/api/v1/portfolios/me"));
    expect(me.status).toBe(200);
    const section = me.body.data.draft.content.sections[0];
    expect(section.type).toBe("certifications");
    expect(section.subtitle).toBe("Verified credentials");
    expect(section.settings).toEqual({ layout: "grid", columns: 2 });
  });
});

describe("V-042 lapse suspends premium templates only", () => {
  /**
   * A paying subscriber whose paid period has since run out: activated 40 days ago for a
   * 30-day period (the row is edited directly because an `active` event with a past period
   * grants nothing), so the next lapse event finds nothing left to honour.
   */
  async function lapsedSubscriber(templateId: "signal" | "nimbus") {
    const user = await createUserWithSession();
    const seeded = await seedPublication(user.id, templateId);
    const subscriptionId = `sub_${randomUUID()}`;
    const start = new Date(Date.now() - 40 * DAY_MS);
    await deliver(
      subscriptionEvent({
        userId: user.id,
        subscriptionId,
        status: "active",
        at: start,
        nextBillingDate: new Date(Date.now() + 30 * DAY_MS),
      }),
    );
    expect((await publicationOf(user.id)).status).toBe("LIVE");
    await prisma.subscription.updateMany({
      where: { providerSubId: subscriptionId },
      data: { currentPeriodEnd: new Date(start.getTime() + 30 * DAY_MS) },
    });
    return { user, subscriptionId, ...seeded };
  }

  it("expired past the paid period: Signal stays LIVE, Nimbus is SUSPENDED", async () => {
    const signal = await lapsedSubscriber("signal");
    const nimbus = await lapsedSubscriber("nimbus");

    for (const { user, subscriptionId } of [signal, nimbus]) {
      await deliver(
        subscriptionEvent({
          userId: user.id,
          subscriptionId,
          status: "expired",
          at: new Date(Date.now() - 5 * DAY_MS),
          nextBillingDate: null,
        }),
      );
    }

    await suspendExpiredGracePeriods();

    expect((await publicationOf(signal.user.id)).status).toBe("LIVE");
    expect((await publicationOf(nimbus.user.id)).status).toBe("SUSPENDED");
  });

  it("on_hold then grace expiry through the job: Signal stays LIVE, Nimbus is SUSPENDED", async () => {
    const signal = await lapsedSubscriber("signal");
    const nimbus = await lapsedSubscriber("nimbus");

    for (const { user, subscriptionId } of [signal, nimbus]) {
      await deliver(
        subscriptionEvent({
          userId: user.id,
          subscriptionId,
          status: "on_hold",
          at: new Date(Date.now() - 5 * DAY_MS),
          nextBillingDate: null,
        }),
      );
      await prisma.subscription.updateMany({
        where: { providerSubId: subscriptionId },
        data: { graceEndsAt: new Date(Date.now() - DAY_MS) },
      });
    }

    expect((await publicationOf(signal.user.id)).status).toBe("LIVE");
    expect((await publicationOf(nimbus.user.id)).status).toBe("GRACE");

    await suspendExpiredGracePeriods();

    expect((await publicationOf(signal.user.id)).status).toBe("LIVE");
    expect((await publicationOf(nimbus.user.id)).status).toBe("SUSPENDED");
  });
});

describe("V-044 isPremium comes from grants", () => {
  it("a MANUAL portfolio_publish grant makes the public read premium", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "nimbus");
    await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        key: "portfolio_publish",
        source: "MANUAL",
        sourceId: randomUUID(),
      },
    });

    const response = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(response.status).toBe(200);
    expect(response.body.data.isPremium).toBe(true);
  });

  it("no grant means not premium even with a stray ACTIVE subscription row", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "signal");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        provider: "dodo",
        providerSubId: `sub_${randomUUID()}`,
        providerCustomerId: "cus_x",
        productKey: "portfolio_pro",
        interval: "MONTHLY",
        status: "ACTIVE",
        rawStatus: "active",
        currentPeriodEnd: new Date(Date.now() + 10 * DAY_MS),
      },
    });

    const response = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(response.status).toBe(200);
    expect(response.body.data.isPremium).toBe(false);
  });
});

describe("V-075 admin billing edits reconcile access", () => {
  it("granting portfolio_publish to a billing-suspended user brings the publication LIVE without a webhook", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "nimbus", {
      status: "SUSPENDED",
      suspensionReason: "CANCELED",
    });

    const grant = await asUser(
      await admin(),
      request(app).post("/api/v1/admin/billing/entitlements"),
    ).send({ userId: user.id, key: "portfolio_publish", reason: "Ambassador comp for Q4" });
    expect(grant.status).toBe(200);

    const row = await publicationOf(user.id);
    expect(row.status).toBe("LIVE");
    expect(row.suspensionReason).toBeNull();

    const pub = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.isPremium).toBe(true);
  });

  it("revoking the only publish grant suspends a premium publication and leaves a free one LIVE", async () => {
    const premium = await createUserWithSession();
    const free = await createUserWithSession();
    await seedPublication(premium.id, "cipher");
    await seedPublication(free.id, "atelier");

    const grants = await Promise.all(
      [premium, free].map((user) =>
        prisma.entitlementGrant.create({
          data: {
            userId: user.id,
            key: "portfolio_publish",
            source: "MANUAL",
            sourceId: randomUUID(),
          },
        }),
      ),
    );

    for (const grant of grants) {
      const revoke = await asUser(
        await admin(),
        request(app).delete(`/api/v1/admin/billing/entitlements/${grant.id}`),
      ).send({ reason: "Comp period ended" });
      expect(revoke.status).toBe(200);
    }

    expect((await publicationOf(premium.id)).status).toBe("SUSPENDED");
    expect((await publicationOf(free.id)).status).toBe("LIVE");
  });

  it("admin credit adjustments record the acting admin and dedupe on an Idempotency-Key", async () => {
    const user = await createUserWithSession();
    const key = `adj-${randomUUID()}`;

    for (let i = 0; i < 2; i += 1) {
      const response = await asUser(
        await admin(),
        request(app).post("/api/v1/admin/billing/credits"),
      )
        .set("Idempotency-Key", key)
        .send({ userId: user.id, amount: 50, reason: "Support goodwill credit" });
      expect(response.status).toBe(200);
    }

    const wallet = await prisma.creditWallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.balance).toBe(50);

    const tx = await prisma.creditTransaction.findFirst({
      where: { userId: user.id, type: "GRANT" },
    });
    expect((tx?.metadata as { actorId?: string } | null)?.actorId).toBe((await admin()).id);

    // The replay changed nothing, so it is audited once.
    const audits = await prisma.adminAuditEntry.count({
      where: { action: "billing.credit.adjust", targetId: user.id },
    });
    expect(audits).toBe(1);
  });

  it("an Idempotency-Key reused for a different request is a 409 and credits nobody", async () => {
    const userA = await createUserWithSession();
    const userB = await createUserWithSession();
    const key = `adj-${randomUUID()}`;

    const first = await asUser(await admin(), request(app).post("/api/v1/admin/billing/credits"))
      .set("Idempotency-Key", key)
      .send({ userId: userA.id, amount: 50, reason: "Support goodwill credit" });
    expect(first.status).toBe(200);

    const otherUser = await asUser(
      await admin(),
      request(app).post("/api/v1/admin/billing/credits"),
    )
      .set("Idempotency-Key", key)
      .send({ userId: userB.id, amount: 50, reason: "Support goodwill credit" });
    expect(otherUser.status).toBe(409);

    const otherAmount = await asUser(
      await admin(),
      request(app).post("/api/v1/admin/billing/credits"),
    )
      .set("Idempotency-Key", key)
      .send({ userId: userA.id, amount: 75, reason: "Support goodwill credit" });
    expect(otherAmount.status).toBe(409);

    expect(await prisma.creditWallet.findUnique({ where: { userId: userB.id } })).toBeNull();
    expect((await prisma.creditWallet.findUnique({ where: { userId: userA.id } }))?.balance).toBe(
      50,
    );
  });
});

describe("V-076 admin document moderation unpublishes a portfolio", () => {
  it("hiding the PORTFOLIO document suspends its publication", async () => {
    const user = await createUserWithSession();
    const { document, publication } = await seedPublication(user.id, "signal");

    const hide = await asUser(
      await admin(),
      request(app).patch(`/api/v1/admin/documents/${document.id}`),
    ).send({ visibility: "PRIVATE", reason: "Contains copyrighted material" });
    expect(hide.status).toBe(200);

    const row = await publicationOf(user.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toMatch(/^moderation:/);

    const pub = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(pub.status).toBe(404);
  });

  it("soft-deleting the PORTFOLIO document suspends its publication", async () => {
    const user = await createUserWithSession();
    const { document } = await seedPublication(user.id, "nimbus");

    const remove = await asUser(
      await admin(),
      request(app).delete(`/api/v1/admin/documents/${document.id}`),
    ).send({ reason: "Phishing page hosted on the portfolio" });
    expect(remove.status).toBe(200);

    const row = await publicationOf(user.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toMatch(/^moderation:/);
  });
});

describe("V-043 / V-050 public cache namespace and reserved subdomains", () => {
  it("the subdomain 'list' never returns the sitemap list, and the list is never a publication", async () => {
    const user = await createUserWithSession();
    await seedPublication(user.id, "signal");

    const list = await publicGet("/api/v1/portfolios/public");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThan(0);

    const asSite = await publicGet("/api/v1/portfolios/public/list");
    expect(asSite.status).toBe(404);

    const listAgain = await publicGet("/api/v1/portfolios/public");
    expect(listAgain.status).toBe(200);
    expect(Array.isArray(listAgain.body.data)).toBe(true);
  });

  it("reserved and invalid public subdomains with no publication are 404, not 400", async () => {
    for (const name of ["mail", "status", "xn--pple-43d", "---", "admin"]) {
      const response = await publicGet(`/api/v1/portfolios/public/${name}`);
      expect(response.status, name).toBe(404);
    }
  });

  it("a publication that predates the reserved list keeps serving and its owner keeps saving; a newcomer is refused", async () => {
    const owner = await createUserWithSession();
    const { document } = await seedPublication(owner.id, "signal", { subdomain: "dev" });

    const served = await publicGet("/api/v1/portfolios/public/dev");
    expect(served.status).toBe(200);
    expect(served.body.data.subdomain).toBe("dev");

    const ownerSave = await asUser(owner, request(app).put("/api/v1/portfolios/draft")).send({
      documentId: document.id,
      revision: document.revision,
      subdomain: "dev",
      snapshot: validContent("signal"),
    });
    expect(ownerSave.status).toBe(200);
    expect(ownerSave.body.data.slug).toBe("dev");

    const ownerCheck = await asUser(
      owner,
      request(app).get("/api/v1/portfolios/subdomains/dev/availability"),
    );
    expect(ownerCheck.status).toBe(200);
    expect(ownerCheck.body.data.available).toBe(true);

    const newcomer = await createUserWithSession();
    const newcomerSave = await asUser(newcomer, request(app).put("/api/v1/portfolios/draft")).send({
      subdomain: "dev",
      snapshot: validContent("signal"),
    });
    expect(newcomerSave.status).toBe(400);

    const newcomerCheck = await asUser(
      newcomer,
      request(app).get("/api/v1/portfolios/subdomains/help/availability"),
    );
    expect(newcomerCheck.status).toBe(400);
  });
});

describe("free templates have no grace period", () => {
  it("admin cannot move a free-template publication to GRACE", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "atelier");

    const response = await asUser(
      await admin(),
      request(app).patch(`/api/v1/admin/portfolios/${publication.id}`),
    ).send({ status: "GRACE", reason: "Trying to park a free site" });
    expect(response.status).toBe(400);
    expect((await publicationOf(user.id)).status).toBe("LIVE");
  });

  it("a free-template publication never renders as premium, grant or not", async () => {
    const user = await createUserWithSession();
    const { publication } = await seedPublication(user.id, "signal");
    await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        key: "portfolio_publish",
        source: "MANUAL",
        sourceId: randomUUID(),
      },
    });

    const response = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(response.status).toBe(200);
    expect(response.body.data.isPremium).toBe(false);
  });
});

describe("pass and comp expiry through the access job", () => {
  async function withGrant(userId: string, endsAt: Date | null) {
    await prisma.entitlementGrant.create({
      data: {
        userId,
        key: "portfolio_publish",
        source: "SYSTEM",
        sourceId: randomUUID(),
        startsAt: new Date(Date.now() - 10 * DAY_MS),
        endsAt,
        metadata: { pass: true },
      },
    });
  }

  it("an expired pass moves a premium publication to GRACE, then SUSPENDED after the grace days; a live pass and a free template are untouched", async () => {
    const expired = await createUserWithSession();
    const live = await createUserWithSession();
    const free = await createUserWithSession();
    const { publication } = await seedPublication(expired.id, "nimbus");
    await seedPublication(live.id, "cipher");
    await seedPublication(free.id, "signal");
    await withGrant(expired.id, new Date(Date.now() - DAY_MS));
    await withGrant(live.id, new Date(Date.now() + DAY_MS));
    await withGrant(free.id, new Date(Date.now() - DAY_MS));

    await suspendExpiredGracePeriods();

    expect((await publicationOf(expired.id)).status).toBe("GRACE");
    expect((await publicationOf(live.id)).status).toBe("LIVE");
    expect((await publicationOf(free.id)).status).toBe("LIVE");

    // Still inside the window: served, and as premium.
    const served = await publicGet(`/api/v1/portfolios/public/${publication.subdomain}`);
    expect(served.status).toBe(200);
    expect(served.body.data.isPremium).toBe(true);

    await suspendExpiredGracePeriods();
    expect((await publicationOf(expired.id)).status).toBe("GRACE");

    // The window is measured from the GRACE transition (no subscription clock exists).
    await prisma.$executeRaw`UPDATE "PortfolioPublication" SET "updatedAt" = now() - interval '8 days' WHERE "id" = ${publication.id}`;
    await suspendExpiredGracePeriods();

    const row = await publicationOf(expired.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.suspensionReason).toBe("grace_expired");
  });
});

describe("admin entitlement search", () => {
  it("filters by the owner's email or name, ANDed with the active filter", async () => {
    const alice = await createUserWithSession({
      name: "Alice Needle",
      email: `alice-${randomUUID().slice(0, 6)}@example.test`,
    });
    const bob = await createUserWithSession({ name: "Bob Hay" });
    for (const user of [alice, bob]) {
      await prisma.entitlementGrant.create({
        data: { userId: user.id, key: "analytics", source: "MANUAL", sourceId: randomUUID() },
      });
    }
    await prisma.entitlementGrant.create({
      data: {
        userId: alice.id,
        key: "seo_controls",
        source: "MANUAL",
        sourceId: randomUUID(),
        revokedAt: new Date(),
      },
    });

    const byName = await asUser(
      await admin(),
      request(app)
        .get("/api/v1/admin/billing/entitlements")
        .query({ query: "needle", active: "true" }),
    );
    expect(byName.status).toBe(200);
    expect(byName.body.data.items.map((item: { userId: string }) => item.userId)).toEqual([
      alice.id,
    ]);

    const byEmail = await asUser(
      await admin(),
      request(app).get("/api/v1/admin/billing/entitlements").query({ query: "ALICE-" }),
    );
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.total).toBe(2);

    const all = await asUser(
      await admin(),
      request(app).get("/api/v1/admin/billing/entitlements").query({ userId: bob.id }),
    );
    expect(all.body.data.total).toBe(1);
  });
});

describe("V-137 portfolio status codes", () => {
  it("POST /portfolios/unpublish with no publication is 404", async () => {
    const user = await createUserWithSession();
    const response = await asUser(user, request(app).post("/api/v1/portfolios/unpublish")).send();
    expect(response.status).toBe(404);
  });

  it("publishing a premium template without entitlement is 402", async () => {
    const user = await createUserWithSession();
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        type: "PORTFOLIO",
        title: "Portfolio",
        slug: `nimbus-${randomUUID().slice(0, 8)}`,
        templateId: "nimbus",
        content: validContent("nimbus"),
      },
    });

    const response = await asUser(user, request(app).post("/api/v1/portfolios/publish")).send({
      documentId: document.id,
      subdomain: document.slug,
      revision: document.revision,
    });
    expect(response.status).toBe(402);
  });
});
