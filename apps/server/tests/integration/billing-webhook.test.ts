import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";

import { createUserWithSession } from "./helpers/auth.js";
import { signDodoWebhook } from "./helpers/webhook.js";

const WEBHOOK_PATH = "/api/v1/billing/webhooks/dodo";

function subscriptionActiveEvent(userId: string, subscriptionId: string) {
  const now = new Date();
  const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return JSON.stringify({
    type: "subscription.active",
    timestamp: now.toISOString(),
    data: {
      subscription_id: subscriptionId,
      customer: { customer_id: "cus_integration" },
      product_id: "prod_ai_credits_monthly",
      status: "active",
      cancel_at_next_billing_date: false,
      next_billing_date: nextBilling.toISOString(),
      metadata: { veriworkly_user_id: userId },
    },
  });
}

function post(body: string, headers: Record<string, string>) {
  const req = request(app).post(WEBHOOK_PATH);
  for (const [key, value] of Object.entries(headers)) req.set(key, value);
  return req.send(body);
}

describe("Dodo webhook end-to-end (signature, idempotency, concurrency)", () => {
  it("refuses an unsigned delivery and a delivery with a wrong signature", async () => {
    const user = await createUserWithSession();
    const body = subscriptionActiveEvent(user.id, "sub_unsigned");

    const unsigned = await post(body, { "content-type": "application/json", "webhook-id": "x" });
    expect(unsigned.status).toBe(400);
    expect(unsigned.body).toMatchObject({ success: false, message: "Invalid webhook signature." });

    const wrongKey = signDodoWebhook(body, {
      secret: "whsec_////////////////////////////////////////////",
    });
    const forged = await post(body, wrongKey);
    expect(forged.status).toBe(400);

    // Stale timestamps are replays: outside the 5-minute tolerance the signature is refused too.
    const stale = signDodoWebhook(body, { timestamp: new Date(Date.now() - 10 * 60 * 1000) });
    const replayed = await post(body, stale);
    expect(replayed.status).toBe(400);

    expect(await prisma.subscription.count({ where: { providerSubId: "sub_unsigned" } })).toBe(0);
    expect(
      await prisma.billingWebhookEvent.count({
        where: { providerEventId: { in: ["x", wrongKey["webhook-id"], stale["webhook-id"]] } },
      }),
    ).toBe(0);
  });

  it("activates a subscription and grants its entitlements from a signed delivery", async () => {
    const user = await createUserWithSession();
    const body = subscriptionActiveEvent(user.id, "sub_active_1");
    const headers = signDodoWebhook(body);

    const response = await post(body, headers);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ duplicate: false });

    const subscription = await prisma.subscription.findUnique({
      where: { providerSubId: "sub_active_1" },
    });
    expect(subscription?.userId).toBe(user.id);
    expect(subscription?.status).toBe("ACTIVE");
    expect(subscription?.productKey).toBe("ai_credits");

    const grants = await prisma.entitlementGrant.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(grants.map((g) => g.key)).toContain("ai_credits");

    const event = await prisma.billingWebhookEvent.findUnique({
      where: { providerEventId: headers["webhook-id"] },
    });
    expect(event?.status).toBe("PROCESSED");
    expect(event?.userId).toBe(user.id);
  });

  it("treats a redelivery of the same webhook-id as a duplicate", async () => {
    const user = await createUserWithSession();
    const body = subscriptionActiveEvent(user.id, "sub_redelivered");
    const headers = signDodoWebhook(body);

    const first = await post(body, headers);
    expect(first.body.data).toEqual({ duplicate: false });

    const second = await post(body, headers);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual({ duplicate: true });

    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.billingWebhookEvent.count({
        where: { providerEventId: headers["webhook-id"] },
      }),
    ).toBe(1);
  });

  it("serialises two concurrent deliveries of the same event", async () => {
    const user = await createUserWithSession();
    const body = subscriptionActiveEvent(user.id, "sub_concurrent");
    const headers = signDodoWebhook(body);

    const [a, b] = await Promise.all([post(body, headers), post(body, headers)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.data.duplicate, b.body.data.duplicate].sort()).toEqual([false, true]);
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.entitlementGrant.count({ where: { userId: user.id, key: "ai_credits" } }),
    ).toBe(1);
  });
});
