import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";
import { ApiError } from "#lib/errors";
import { prisma } from "#lib/prisma";
import { SHARED_ADDRESS_REASON } from "#services/affiliate/commissions";
import { AffiliateService } from "#services/affiliate/index";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

const BASE = "/api/v1/affiliates";
const ADMIN_BASE = "/api/v1/admin/affiliates";
const DAY_MS = 24 * 60 * 60 * 1000;

const asUser = (user: TestUser) => ({
  get: (url: string) =>
    request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  post: (url: string) =>
    request(app).post(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  patch: (url: string) =>
    request(app).patch(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
});

/**
 * An enrolled affiliate whose session came from a routable address. Every test request arrives
 * from loopback and the helper records loopback on the session too, so without this every
 * referral in the suite would be flagged as sharing the affiliate's address.
 */
async function enrolledAffiliate(sessionIp = "203.0.113.7") {
  const user = await createUserWithSession();
  await prisma.session.updateMany({ where: { userId: user.id }, data: { ipAddress: sessionIp } });
  const response = await asUser(user).post(`${BASE}/enroll`).send({});
  expect(response.status).toBe(200);
  const code = response.body.data.affiliateCode as string;
  expect(code).toMatch(/^[a-f0-9]{10}$/);
  return { user, code };
}

async function referredUser(code: string) {
  const user = await createUserWithSession();
  const response = await asUser(user).post(`${BASE}/referral`).send({ code });
  expect(response.status).toBe(200);
  return user;
}

/** The configured admin (env.ts sets ADMIN_EMAIL); one account shared by every test in the file. */
let adminPromise: Promise<TestUser> | undefined;
const adminUser = () =>
  (adminPromise ??= createUserWithSession({ email: "admin@example.test", emailVerified: true }));

const wallet = (userId: string) =>
  prisma.affiliateWallet.findUniqueOrThrow({
    where: { userId },
    select: { pendingCents: true, availableCents: true, paidCents: true },
  });

const statusOf = (result: PromiseSettledResult<unknown>) =>
  result.status === "fulfilled"
    ? 200
    : result.reason instanceof ApiError
      ? result.reason.statusCode
      : 500;

describe("affiliate enrollment (V-003)", () => {
  it("(a) refuses a SUSPENDED affiliate with 403 and leaves the status alone", async () => {
    const user = await createUserWithSession();
    await prisma.user.update({
      where: { id: user.id },
      data: { affiliateStatus: "SUSPENDED", affiliateCode: "deadbeef00" },
    });

    const response = await asUser(user).post(`${BASE}/enroll`).send({});
    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Affiliate account is suspended");

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { affiliateStatus: true, affiliateCode: true },
    });
    expect(after).toEqual({ affiliateStatus: "SUSPENDED", affiliateCode: "deadbeef00" });
  });

  it("returns the code already issued on a repeat or concurrent enroll", async () => {
    const { user, code } = await enrolledAffiliate();

    const again = await asUser(user).post(`${BASE}/enroll`).send({});
    expect(again.status).toBe(200);
    expect(again.body.data.affiliateCode).toBe(code);

    const fresh = await createUserWithSession();
    const burst = await Promise.all(
      Array.from({ length: 8 }, () => asUser(fresh).post(`${BASE}/enroll`).send({})),
    );
    const codes = new Set(burst.map((r) => r.body.data?.affiliateCode));
    expect(burst.map((r) => r.status)).toEqual(Array(8).fill(200));
    expect(codes.size).toBe(1);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: fresh.id },
      select: { affiliateCode: true, affiliateStatus: true },
    });
    expect(stored.affiliateStatus).toBe("ACTIVE");
    expect(codes.has(stored.affiliateCode)).toBe(true);
  });
});

describe("commission transitions (V-007, V-017)", () => {
  it("(b) ten concurrent AVAILABLE on one PENDING commission credit the wallet exactly once", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const buyer = await referredUser(code);

    const commission = await AffiliateService.createCommission({
      referredUserId: buyer.id,
      providerPaymentId: "pay_concurrent_available",
      purchaseAmountCents: 100_000,
      status: "PENDING",
    });
    expect(commission.amountCents).toBe(2_000);
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 2_000,
      availableCents: 0,
      paidCents: 0,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        AffiliateService.updateCommission(commission.id, "AVAILABLE", "release"),
      ),
    );
    const statuses = results.map(statusOf).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);

    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 0,
      availableCents: 2_000,
      paidCents: 0,
    });
    const stored = await prisma.affiliateCommission.findUniqueOrThrow({
      where: { id: commission.id },
    });
    expect(stored.status).toBe("AVAILABLE");
    expect(stored.currency).toBe("USD");
  });

  it("PENDING -> REVERSED on a USD commission takes it out of pending and nothing else", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const buyer = await referredUser(code);
    const commission = await AffiliateService.createCommission({
      referredUserId: buyer.id,
      providerPaymentId: "pay_reversed_usd",
      purchaseAmountCents: 50_000,
      status: "PENDING",
    });
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 1_000,
      availableCents: 0,
      paidCents: 0,
    });

    const reversed = await AffiliateService.updateCommission(commission.id, "REVERSED", "refund");
    expect(reversed.status).toBe("REVERSED");
    expect(reversed.reversedAt).toBeInstanceOf(Date);
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
    });
    // Nothing is pending any more, so a second transition of either kind is refused.
    await expect(
      AffiliateService.updateCommission(commission.id, "AVAILABLE"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to release a commission the wallet's pending balance no longer covers", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const buyer = await referredUser(code);
    const commission = await AffiliateService.createCommission({
      referredUserId: buyer.id,
      providerPaymentId: "pay_uncovered",
      purchaseAmountCents: 50_000,
      status: "PENDING",
    });
    // A ledger inconsistency, simulated directly: the row says 1,000 pending, the wallet says 0.
    await prisma.affiliateWallet.update({
      where: { userId: affiliate.id },
      data: { pendingCents: 0 },
    });

    await expect(
      AffiliateService.updateCommission(commission.id, "AVAILABLE"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Wallet pending balance does not cover this commission.",
    });
    // The status flip rolled back with the wallet guard.
    const stored = await prisma.affiliateCommission.findUniqueOrThrow({
      where: { id: commission.id },
    });
    expect(stored.status).toBe("PENDING");
    expect(stored.availableAt).toBeNull();
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
    });
  });

  it("(f) stores a non-USD commission with its currency and never touches the USD wallet", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const buyer = await referredUser(code);

    const commission = await AffiliateService.createCommission({
      referredUserId: buyer.id,
      providerPaymentId: "pay_inr_1",
      purchaseAmountCents: 500_000,
      status: "AVAILABLE",
      currency: "inr",
    });
    expect(commission.currency).toBe("INR");
    expect(commission.status).toBe("PENDING");
    expect(commission.amountCents).toBe(10_000);
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
    });

    // Releasing it would credit rupees into a dollar balance: refused until someone converts.
    await expect(
      AffiliateService.updateCommission(commission.id, "AVAILABLE"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await prisma.affiliateCommission.findUniqueOrThrow({ where: { id: commission.id } })).status,
    ).toBe("PENDING");

    // The admin list flags it, the USD total ignores it, and the summary counts it for conversion.
    const admin = await adminUser();
    const list = await asUser(admin).get(`${ADMIN_BASE}/commissions?limit=20&offset=0`);
    expect(list.status).toBe(200);
    const row = list.body.data.items.find((item: { id: string }) => item.id === commission.id);
    expect(row).toMatchObject({ currency: "INR", requiresManualConversion: true });
    const usdTotal = await prisma.affiliateCommission.aggregate({
      where: { currency: "USD" },
      _sum: { amountCents: true },
    });
    expect(list.body.data.totalAmountCents).toBe(usdTotal._sum.amountCents ?? 0);
    const summary = await asUser(admin).get(`${ADMIN_BASE}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.commissionsAwaitingConversion).toBeGreaterThanOrEqual(1);

    // Manual conversion: the admin records the USD amount and names the original, which is
    // reversed in the same transaction so it cannot be converted twice.
    const converted = await asUser(admin).post(`${ADMIN_BASE}/commissions`).send({
      referredUserId: buyer.id,
      providerPaymentId: "pay_inr_1:usd",
      purchaseAmountCents: 600_000,
      status: "PENDING",
      currency: "usd",
      convertedFromId: commission.id,
      reason: "INR 5,000.00 converted at 0.012",
    });
    expect(converted.status).toBe(200);
    expect(converted.body.data).toMatchObject({ currency: "USD", amountCents: 12_000 });
    const original = await prisma.affiliateCommission.findUniqueOrThrow({
      where: { id: commission.id },
    });
    expect(original.status).toBe("REVERSED");
    expect(original.reason).toBe(`Converted to USD as ${converted.body.data.id}`);
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 12_000,
      availableCents: 0,
      paidCents: 0,
    });

    // A second conversion of the same original is refused and creates nothing.
    const again = await asUser(admin).post(`${ADMIN_BASE}/commissions`).send({
      referredUserId: buyer.id,
      providerPaymentId: "pay_inr_1:usd-again",
      purchaseAmountCents: 600_000,
      convertedFromId: commission.id,
    });
    expect(again.status).toBe(409);
    expect(
      await prisma.affiliateCommission.count({
        where: { providerPaymentId: "pay_inr_1:usd-again" },
      }),
    ).toBe(0);

    // The validator upper-cases and rejects anything that is not three letters.
    const badCurrency = await asUser(admin).post(`${ADMIN_BASE}/commissions`).send({
      referredUserId: buyer.id,
      providerPaymentId: "pay_bad_currency",
      purchaseAmountCents: 1_000,
      currency: "rupees",
    });
    expect(badCurrency.status).toBe(400);
  });
});

describe("withdrawal transitions (V-007, one active withdrawal)", () => {
  it("(c) concurrent PAID and REJECTED on one withdrawal: one wins, the loser gets 409", async () => {
    const { user: affiliate } = await enrolledAffiliate();
    await prisma.affiliateWallet.update({
      where: { userId: affiliate.id },
      data: { availableCents: 10_000 },
    });

    const requested = await asUser(affiliate)
      .post(`${BASE}/withdrawals`)
      .send({ amountCents: 5_000 });
    expect(requested.status).toBe(200);
    const withdrawalId = requested.body.data.id as string;
    expect(requested.body.data.currency).toBe("USD");
    expect((await wallet(affiliate.id)).availableCents).toBe(5_000);

    const admin = await adminUser();
    const approved = await asUser(admin)
      .patch(`${ADMIN_BASE}/withdrawals/${withdrawalId}`)
      .send({ status: "APPROVED" });
    expect(approved.status).toBe(200);

    const [paid, rejected] = await Promise.all([
      asUser(admin)
        .patch(`${ADMIN_BASE}/withdrawals/${withdrawalId}`)
        .send({ status: "PAID", payoutNote: "wire sent" }),
      asUser(admin)
        .patch(`${ADMIN_BASE}/withdrawals/${withdrawalId}`)
        .send({ status: "REJECTED", payoutNote: "duplicate" }),
    ]);
    expect([paid.status, rejected.status].sort()).toEqual([200, 409]);

    const stored = await prisma.affiliateWithdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
    });
    const balance = await wallet(affiliate.id);
    if (paid.status === 200) {
      expect(stored.status).toBe("PAID");
      expect(balance).toEqual({ pendingCents: 0, availableCents: 5_000, paidCents: 5_000 });
    } else {
      expect(stored.status).toBe("REJECTED");
      expect(balance).toEqual({ pendingCents: 0, availableCents: 10_000, paidCents: 0 });
    }
    // Money is conserved: available + paid + whatever is still in flight equals the opening 10,000.
    const inFlight = await prisma.affiliateWithdrawal.aggregate({
      where: { userId: affiliate.id, status: { in: ["REQUESTED", "APPROVED"] } },
      _sum: { amountCents: true },
    });
    expect(balance.availableCents + balance.paidCents + (inFlight._sum.amountCents ?? 0)).toBe(
      10_000,
    );
  });

  it("REQUESTED -> REJECTED refunds the reservation and frees the slot for a new request", async () => {
    const { user: affiliate } = await enrolledAffiliate();
    await prisma.affiliateWallet.update({
      where: { userId: affiliate.id },
      data: { availableCents: 10_000 },
    });
    const requested = await asUser(affiliate)
      .post(`${BASE}/withdrawals`)
      .send({ amountCents: 4_000 });
    expect(requested.status).toBe(200);
    expect((await wallet(affiliate.id)).availableCents).toBe(6_000);

    const admin = await adminUser();
    const rejected = await asUser(admin)
      .patch(`${ADMIN_BASE}/withdrawals/${requested.body.data.id}`)
      .send({ status: "REJECTED", payoutNote: "details missing" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({ status: "REJECTED", reviewedBy: admin.id });
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 0,
      availableCents: 10_000,
      paidCents: 0,
    });

    // Finalized rows cannot move again, and the partial index no longer counts them.
    const paidAfter = await asUser(admin)
      .patch(`${ADMIN_BASE}/withdrawals/${requested.body.data.id}`)
      .send({ status: "PAID" });
    expect(paidAfter.status).toBe(409);
    const next = await asUser(affiliate).post(`${BASE}/withdrawals`).send({ amountCents: 2_500 });
    expect(next.status).toBe(200);
  });

  it("(d) two concurrent withdrawal requests leave one row and one 409", async () => {
    const { user: affiliate } = await enrolledAffiliate();
    await prisma.affiliateWallet.update({
      where: { userId: affiliate.id },
      data: { availableCents: 10_000 },
    });

    const [first, second] = await Promise.all([
      asUser(affiliate).post(`${BASE}/withdrawals`).send({ amountCents: 2_500 }),
      asUser(affiliate).post(`${BASE}/withdrawals`).send({ amountCents: 2_500 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.message).toBe("A withdrawal is already in progress");

    expect(await prisma.affiliateWithdrawal.count({ where: { userId: affiliate.id } })).toBe(1);
    expect((await wallet(affiliate.id)).availableCents).toBe(7_500);

    // The partial unique index is the guarantee, not the pre-check: a direct second insert fails.
    await expect(
      prisma.affiliateWithdrawal.create({ data: { userId: affiliate.id, amountCents: 2_500 } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("referral attribution (V-016)", () => {
  it("(e) ignores a code used by an account created 40 days ago", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const old = await createUserWithSession();
    await prisma.user.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 40 * DAY_MS) },
    });

    const response = await asUser(old).post(`${BASE}/referral`).send({ code });
    expect(response.status).toBe(409);
    expect(await prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id } })).toBe(0);
  });

  it("ignores a code used by an account that has already paid", async () => {
    const { user: affiliate, code } = await enrolledAffiliate();
    const payer = await createUserWithSession();
    await prisma.subscription.create({
      data: {
        userId: payer.id,
        provider: "dodo",
        providerSubId: "sub_already_paid",
        productKey: "ai_credits",
        status: "ACTIVE",
      },
    });

    const response = await asUser(payer).post(`${BASE}/referral`).send({ code });
    expect(response.status).toBe(409);
    expect(await prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id } })).toBe(0);
  });

  it("records a referral from one of the affiliate's own addresses and holds its commissions", async () => {
    // One of the affiliate's sessions is loopback, exactly where the test request comes from.
    const { user: affiliate, code } = await enrolledAffiliate("203.0.113.9");
    await prisma.session.create({
      data: {
        id: `sess_${affiliate.id}_home`,
        token: `tok_${affiliate.id}_home`,
        userId: affiliate.id,
        expiresAt: new Date(Date.now() + DAY_MS),
        ipAddress: "127.0.0.1",
      },
    });
    const alt = await createUserWithSession();

    const applied = await asUser(alt).post(`${BASE}/referral`).send({ code });
    expect(applied.status).toBe(200);
    const flagged = await prisma.affiliateReferral.findUniqueOrThrow({
      where: { referredUserId: alt.id },
    });
    expect(flagged.sharedAddressWithAffiliate).toBe(true);

    // Whatever the caller asks for, money from that referral waits for a human.
    const held = await AffiliateService.createCommission({
      referredUserId: alt.id,
      providerPaymentId: "pay_shared_address",
      purchaseAmountCents: 100_000,
      status: "AVAILABLE",
      reason: "Dodo payment succeeded",
    });
    expect(held).toMatchObject({ status: "PENDING", reason: SHARED_ADDRESS_REASON });
    expect(await wallet(affiliate.id)).toEqual({
      pendingCents: 2_000,
      availableCents: 0,
      paidCents: 0,
    });

    const admin = await adminUser();
    const referrals = await asUser(admin).get(
      `${ADMIN_BASE}/referrals?affiliateId=${affiliate.id}&limit=20&offset=0`,
    );
    expect(referrals.status).toBe(200);
    expect(referrals.body.data.items).toEqual([
      expect.objectContaining({ id: flagged.id, sharedAddressWithAffiliate: true }),
    ]);

    // A genuinely different address is not flagged, and the request signals are kept hashed.
    const { user: other, code: otherCode } = await enrolledAffiliate("198.51.100.4");
    const newcomer = await createUserWithSession();
    const accepted = await asUser(newcomer)
      .post(`${BASE}/referral`)
      .set("User-Agent", "integration-browser/1.0")
      .send({ code: otherCode });
    expect(accepted.status).toBe(200);

    const referral = await prisma.affiliateReferral.findUniqueOrThrow({
      where: { referredUserId: newcomer.id },
    });
    expect(referral.affiliateId).toBe(other.id);
    expect(referral.sharedAddressWithAffiliate).toBe(false);
    expect(referral.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(referral.userAgentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(referral.ipHash).not.toBe(referral.userAgentHash);

    const click = await request(app)
      .post(`${BASE}/click`)
      .set("Origin", STUDIO_ORIGIN)
      .send({ code: otherCode, referrerHost: "example.test" });
    expect(click.status).toBe(200);
    const clicks = await prisma.affiliateClick.findMany({ where: { affiliateId: other.id } });
    expect(clicks).toHaveLength(1);
    expect(clicks[0].ipHash).toBe(referral.ipHash);
  });
});
