import { EventEmitter } from "node:events";

import type { Response } from "express";
import { describe, expect, it } from "vitest";

import {
  AI_REQUEST_DEADLINE_MS,
  aiRequestSignal,
  maxRetriesWithinDeadline,
  requestClosedSignal,
} from "#services/ats/aiDeadline";

/** A response that can close with or without having finished writing. */
function fakeResponse(writableFinished: boolean) {
  const res = new EventEmitter() as EventEmitter & { writableFinished: boolean };
  res.writableFinished = writableFinished;
  return res as unknown as Response;
}

/**
 * V-034: attempts × timeout + backoff must fit the request deadline, which sits under
 * Cloudflare's 100 s. The policy reader clamps `retries` to this table.
 */
describe("maxRetriesWithinDeadline", () => {
  it("keeps the request deadline under Cloudflare's 100 s", () => {
    expect(AI_REQUEST_DEADLINE_MS).toBeLessThan(90_000);
  });

  it.each([
    // [per-attempt timeout, retries that fit]: worst case (retries + 1) × timeout + 1 s + 2 s
    [120_000, 0],
    [45_000, 0], // 2 × 45 s + 1 s = 91 s does not fit
    [30_000, 1], // 2 × 30 s + 1 s = 61 s fits; 3 × 30 s + 3 s = 93 s does not
    [20_000, 2], // 3 × 20 s + 3 s = 63 s fits
    [5_000, 2], // never more than the policy's own ceiling of two
  ])("with a %i ms timeout allows %i retries", (timeoutMs, retries) => {
    expect(maxRetriesWithinDeadline(timeoutMs)).toBe(retries);
  });

  it("never lets the worst case exceed the deadline", () => {
    for (const timeoutMs of [1_000, 10_000, 20_000, 30_000, 45_000, 60_000, 85_000, 120_000]) {
      const retries = maxRetriesWithinDeadline(timeoutMs);
      const backoff = retries >= 1 ? 1_000 : 0;
      const worstCase = (retries + 1) * timeoutMs + backoff + (retries >= 2 ? 2_000 : 0);
      expect(worstCase).toBeLessThanOrEqual(Math.max(AI_REQUEST_DEADLINE_MS, timeoutMs));
    }
  });
});

describe("requestClosedSignal", () => {
  it("aborts when the connection closes before the response was written", () => {
    const res = fakeResponse(false);
    const signal = requestClosedSignal(res);

    expect(signal.aborted).toBe(false);
    res.emit("close");
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error).message).toMatch(/disconnected/i);
  });

  it("does not abort when the response finished normally", () => {
    const res = fakeResponse(true);
    const signal = requestClosedSignal(res);

    res.emit("close");
    expect(signal.aborted).toBe(false);
  });

  it("is combined with the deadline in the request signal", () => {
    const res = fakeResponse(false);
    const signal = aiRequestSignal(res);

    expect(signal.aborted).toBe(false);
    res.emit("close");
    expect(signal.aborted).toBe(true);
  });
});
