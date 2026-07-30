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
      isOpen: true,
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
      isOpen: true,
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
      isOpen: true,
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
    const redisMockInstance = { isOpen: true, eval: vi.fn() };
    mockGetRedis.mockReturnValue(redisMockInstance);

    req.path = "/api/v1/billing/webhooks/dodo";

    await rateLimitMiddleware(req as Request, res as Response, next);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(next).toHaveBeenCalled();
    expect(redisMockInstance.eval).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

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
