import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * V-096: `/ready` had no timeout, so on an exhausted pool `SELECT 1` waited up to the 30 s
 * connection timeout and the probe hung instead of failing. Each dependency check is now bounded
 * at 2 s and the 503 body names the dependency that timed out.
 */

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  ping: vi.fn(),
  getRedis: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("#lib/prisma", () => {
  const prisma = { $queryRaw: mocks.queryRaw };
  return { prisma, default: prisma };
});
vi.mock("#lib/redis", () => ({ getRedis: mocks.getRedis }));
vi.mock("#lib/logger", () => ({ logger: mocks.logger }));

import { HealthController } from "#controllers/healthController";

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(function (this: typeof res, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: typeof res, body: unknown) {
      this.body = body;
      return this;
    }),
  };
  return res;
}

describe("HealthController.ready timeouts (V-096)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getRedis.mockReturnValue({ ping: mocks.ping });
    mocks.ping.mockResolvedValue("PONG");
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 200 when both dependencies answer", async () => {
    const res = makeRes();

    await HealthController.ready({} as Request, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: { database: "connected", redis: "connected" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns 503 naming the database when the query hangs, within ~2 s", async () => {
    mocks.queryRaw.mockReturnValue(new Promise(() => {}));
    const res = makeRes();

    const pending = HealthController.ready({} as Request, res as unknown as Response);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(res.json).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(101);
    await pending;

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 503,
      details: { database: "timeout", redis: "connected" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns 503 naming redis when ping hangs", async () => {
    mocks.ping.mockReturnValue(new Promise(() => {}));
    const res = makeRes();

    const pending = HealthController.ready({} as Request, res as unknown as Response);
    await vi.advanceTimersByTimeAsync(2_100);
    await pending;

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ details: { database: "connected", redis: "timeout" } });
  });

  it("reports a failed dependency without leaking the error message", async () => {
    mocks.queryRaw.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://admin:secret@db:5432/veriworkly"),
    );
    mocks.getRedis.mockImplementation(() => {
      throw new Error("Redis client not ready");
    });
    const res = makeRes();

    await HealthController.ready({} as Request, res as unknown as Response);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ details: { database: "error", redis: "error" } });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(JSON.stringify(res.body)).not.toContain("postgres://");
  });
});
