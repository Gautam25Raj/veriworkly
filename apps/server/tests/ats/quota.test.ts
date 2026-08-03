import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, number>();

const redis = {
  get: vi.fn(async (key: string) => (store.has(key) ? String(store.get(key)) : null)),
  ttl: vi.fn(async () => 3600),
  eval: vi.fn(async (_script: string, opts: { keys: string[]; arguments: string[] }) => {
    const [key] = opts.keys;
    const limit = Number(opts.arguments[0]);
    const current = store.get(key) ?? 0;
    if (current >= limit) return -1;
    const next = current + 1;
    store.set(key, next);
    return next;
  }),
};

vi.mock("#lib/redis", () => ({ getRedis: () => redis }));
vi.mock("#config", () => ({
  config: { auth: { secret: "test-secret" } },
}));
vi.mock("#services/entitlementService", () => ({
  EntitlementService: { has: vi.fn(async () => false) },
}));
vi.mock("#services/ats/aiPolicy", () => ({
  publicAtsPolicy: vi.fn(() => ({
    analysisCredits: { min: 5, max: 25 },
    jobUrlAnalysisCredits: { min: 10, max: 50 },
    resumeConversionCredits: 25,
  })),
}));

describe("ATS quota — extraction and scanning are independent budgets", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("gives an anonymous caller a single scan per window", async () => {
    const { AtsQuotaService } = await import("../../src/services/ats/quota");

    const first = await AtsQuotaService.consume(undefined, "203.0.113.5");
    expect(first.tier).toBe("anonymous");
    expect(first.remaining).toBe(0);

    await expect(AtsQuotaService.consume(undefined, "203.0.113.5")).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("does not spend the scan quota when a resume is uploaded first", async () => {
    const { AtsQuotaService } = await import("../../src/services/ats/quota");

    await AtsQuotaService.consumeExtract(undefined, "203.0.113.9");
    const summary = await AtsQuotaService.summary(undefined, "203.0.113.9");

    expect(summary.remaining).toBe(1);
    expect(summary.extract.remaining).toBe(2);

    await expect(AtsQuotaService.consume(undefined, "203.0.113.9")).resolves.toMatchObject({
      remaining: 0,
    });
  });

  it("lets an anonymous caller upload a few times before extraction itself is capped", async () => {
    const { AtsQuotaService } = await import("../../src/services/ats/quota");

    await AtsQuotaService.consumeExtract(undefined, "203.0.113.20");
    await AtsQuotaService.consumeExtract(undefined, "203.0.113.20");
    await AtsQuotaService.consumeExtract(undefined, "203.0.113.20");

    await expect(AtsQuotaService.consumeExtract(undefined, "203.0.113.20")).rejects.toMatchObject({
      statusCode: 429,
      message: "ATS upload quota exceeded.",
    });
  });

  it("gives a logged-in free user a bigger, and separate, upload budget", async () => {
    const { AtsQuotaService } = await import("../../src/services/ats/quota");

    const summary = await AtsQuotaService.summary("user_1", "203.0.113.40");
    expect(summary.tier).toBe("free");
    expect(summary.limit).toBe(2);
    expect(summary.extract.limit).toBe(6);
  });
});
