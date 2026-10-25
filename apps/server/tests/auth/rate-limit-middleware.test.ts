import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { mockGetRedis } = vi.hoisted(() => {
  return {
    mockGetRedis: vi.fn(),
  };
});

vi.mock("#config", () => ({
  config: {
    nodeEnv: "production",
    rateLimit: {
      windowMs: 60000,
      maxRequests: 5,
      authWindowMs: 60000,
      authMaxRequests: 2,
      globalWindowMs: 900000,
      globalMaxRequests: 50,
    },
    ai: {
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 3,
    },
  },
}));

vi.mock("#lib/redis", () => ({
  getRedis: mockGetRedis,
}));

vi.mock("#lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { rateLimitMiddleware } from "#middleware/rateLimit";

describe("rateLimitMiddleware", () => {
  let req: Partial<Request> & { headers: Record<string, string> };
  let res: Partial<Response>;
  let next: NextFunction;
  beforeEach(() => {
    mockGetRedis.mockReset();
    req = {
      headers: {},
      ip: "192.168.1.100",
      path: "/api/v1/auth/sign-in",
      method: "POST",
      socket: {
        remoteAddress: "192.168.1.100",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });
  it("passes requests under the limit using Redis", async () => {
    const redisMockInstance = {
      isReady: true,
      // [routeCount, routeTtl, globalCount, globalTtl] — one script bumps both buckets.
      eval: vi.fn().mockResolvedValue([1, 60000, 1, 900000]),
    };
    mockGetRedis.mockReturnValue(redisMockInstance);

    await rateLimitMiddleware(req as Request, res as Response, next);

    // Wait briefly for promises in middleware to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 429 when request count exceeds the limit using Redis", async () => {
    const redisMockInstance = {
      isReady: true,
      // route count 3 against authMaxRequests 2; global bucket still well under its ceiling.
      eval: vi.fn().mockResolvedValue([3, 50000, 3, 900000]),
    };
    mockGetRedis.mockReturnValue(redisMockInstance);

    await rateLimitMiddleware(req as Request, res as Response, next);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith("Retry-After", "50");
  });

  /**
   * The per-route buckets are keyed by (method, path, ip), so on their own they bound each
   * endpoint independently and never bound a client's total load. This coarse bucket is the
   * ceiling underneath them.
   */
  it("returns 429 on the global bucket even when the per-route bucket is under its limit", async () => {
    const redisMockInstance = {
      isReady: true,
      // Route count 1 (limit 2) but global count 51 against globalMaxRequests 50.
      eval: vi.fn().mockResolvedValue([1, 60000, 51, 120000]),
    };
    mockGetRedis.mockReturnValue(redisMockInstance);

    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    // Retry-After comes from the bucket that actually tripped.
    expect(res.set).toHaveBeenCalledWith("Retry-After", "120");
  });

  /**
   * The billing webhook arrives from a handful of provider egress IPs and is authenticated by
   * HMAC signature. Rate limiting it means a provider retry storm gets 429'd and payment state
   * silently diverges from reality.
   */
  it("exempts the billing webhook from IP rate limiting entirely", async () => {
    const redisMockInstance = { isReady: true, eval: vi.fn() };
    mockGetRedis.mockReturnValue(redisMockInstance);

    req.path = "/api/v1/billing/webhooks/dodo";

    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(next).toHaveBeenCalled();
    expect(redisMockInstance.eval).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  /**
   * V-096: a load balancer probing from one IP every few seconds must never be 429'd (the
   * instance would be marked unhealthy), and a liveness probe must not depend on Redis at all.
   * Express routing is case-insensitive and non-strict, so every spelling that reaches the
   * health router has to be exempt.
   */
  it.each([
    "/api/v1/health",
    "/api/v1/health/",
    "/api/v1/HEALTH/ready",
    "/api/v1/health/ready",
    "/api/v1/health/ready/",
  ])("exempts the health endpoint %s without touching Redis", async (path) => {
    Object.assign(req, { path, method: "GET" });

    await rateLimitMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockGetRedis).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(["/api/v1/healthz", "/api/v1/health-x", "/api/v1/health/../admin"])(
    "does not exempt %s, which only shares the health prefix",
    async (path) => {
      const redisMockInstance = {
        isReady: true,
        eval: vi.fn().mockResolvedValue([1, 60000, 1, 1]),
      };
      mockGetRedis.mockReturnValue(redisMockInstance);
      Object.assign(req, { path, method: "GET" });

      await rateLimitMiddleware(req as Request, res as Response, next);

      // Went through the bucket check before being let through.
      expect(mockGetRedis).toHaveBeenCalled();
      expect(redisMockInstance.eval).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(redisMockInstance.eval.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(next).mock.invocationCallOrder[0],
      );
    },
  );

  it("falls back to in-memory storage when Redis fails", async () => {
    mockGetRedis.mockImplementation(() => {
      throw new Error("Redis connection lost");
    });

    // Request 1: should pass
    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(next).toHaveBeenCalled();

    next = vi.fn();
    // Request 2: should pass (limit is 2)
    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(next).toHaveBeenCalled();

    next = vi.fn();
    // Request 3: should fail with 429
    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

/**
 * V-087: Express routing is case-insensitive and ignores a trailing slash, so every spelling that
 * reaches a handler has to land in that handler's limit class and in one bucket.
 */
describe("rateLimitMiddleware path normalisation", () => {
  async function routeCall(path: string) {
    const redisMockInstance = {
      isReady: true,
      eval: vi.fn().mockResolvedValue([1, 60000, 1, 900000]),
    };
    mockGetRedis.mockReturnValue(redisMockInstance);

    const req = {
      headers: {},
      ip: "203.0.113.7",
      path,
      method: "POST",
      socket: { remoteAddress: "203.0.113.7" },
    } as unknown as Request;
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };

    await rateLimitMiddleware(req, res as unknown as Response, vi.fn());

    const [, options] = redisMockInstance.eval.mock.calls[0] as [
      string,
      { keys: string[]; arguments: string[] },
    ];
    return { routeKey: options.keys[0], windowMs: options.arguments[0] };
  }

  beforeEach(() => mockGetRedis.mockReset());

  it("puts /api/v1/Contact/ and /api/v1/contact in one bucket with the contact limit", async () => {
    const canonical = await routeCall("/api/v1/contact");
    const shouted = await routeCall("/api/v1/Contact/");

    expect(shouted.routeKey).toBe(canonical.routeKey);
    expect(canonical.routeKey).toBe("rate-limit:POST:/api/v1/contact:203.0.113.7");
    // 1 hour: the contact class, not the 15-minute default a mis-cased path used to get.
    expect(shouted.windowMs).toBe(String(60 * 60 * 1000));
  });

  it("applies the share-verify class to an upper-case, trailing-slash spelling", async () => {
    const canonical = await routeCall("/api/v1/shares/public/alice/my-resume/verify");
    const shouted = await routeCall("/api/v1/SHARES/PUBLIC/Alice/My-Resume/VERIFY/");

    expect(shouted.routeKey).toBe(canonical.routeKey);
    expect(shouted.windowMs).toBe(String(5 * 60 * 1000));
  });

  it("uses 20 per 5 minutes as the share-verify outer bound (the per-link limit is in the handler)", async () => {
    const outcome = async (routeCount: number) => {
      mockGetRedis.mockReturnValue({
        isReady: true,
        eval: vi.fn().mockResolvedValue([routeCount, 120000, 1, 900000]),
      });
      const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      const req = {
        headers: {},
        ip: "203.0.113.7",
        path: "/api/v1/shares/public/alice/my-resume/verify",
        method: "POST",
        socket: { remoteAddress: "203.0.113.7" },
      } as unknown as Request;
      await rateLimitMiddleware(req, res as unknown as Response, next);
      return { passed: next.mock.calls.length === 1, res };
    };

    expect((await outcome(20)).passed).toBe(true);
    const over = await outcome(21);
    expect(over.passed).toBe(false);
    expect(over.res.status).toHaveBeenCalledWith(429);
  });
});
