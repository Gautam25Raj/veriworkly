import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const consume = vi.fn();
const fetchJobPage = vi.fn();
const check = vi.fn();
const analyze = vi.fn();

vi.mock("#middleware/auth", () => ({
  requireAuthUser: vi.fn(() => ({ id: "user-1" })),
}));

vi.mock("#services/ats/quota", () => ({
  AtsQuotaService: { consume: (...args: unknown[]) => consume(...args) },
}));

vi.mock("#services/ats/jobFetch", () => ({
  AtsJobFetchService: { fetch: (...args: unknown[]) => fetchJobPage(...args) },
}));

vi.mock("#services/ats/scoring", () => ({
  AtsScoringService: { check: (...args: unknown[]) => check(...args) },
}));

vi.mock("#services/ats/ai", () => ({
  AtsAiService: { analyze: (...args: unknown[]) => analyze(...args) },
}));

vi.mock("#utils/requestIp", () => ({
  getRequestIpDetails: vi.fn(() => ({ resolvedIp: "203.0.113.9" })),
}));

const { AtsAiController } = await import("#controllers/ats/aiController");
const { ApiError } = await import("#lib/errors");

function requestFor(body: Record<string, unknown>) {
  return { body, authUser: { id: "user-1" } } as unknown as Request;
}

function responseSpy() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

const baseBody = {
  resume: "Jane Doe jane@example.com Experience Skills",
  requestId: "request-id-1234",
  jobUrl: "https://jobs.example.com/role",
  fetchJobUrl: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  check.mockReturnValue({ version: "ats-v2", failedChecks: [], prioritizedFixes: [] });
  analyze.mockResolvedValue({ ai: null, creditsSpent: 0 });
  fetchJobPage.mockResolvedValue("a job description long enough to score");
  consume.mockResolvedValue({ tier: "free", limit: 2, used: 1, remaining: 1 });
});

describe("POST /ats/analyze — quota gates outbound egress", () => {
  /**
   * The ordering here is the whole point. Fetching the caller-supplied job URL before metering
   * meant a user already at their limit could still make the server issue an arbitrary HTTPS
   * request on every attempt — the 429 only landed after the page had been downloaded. This
   * test fails if that ordering is ever restored.
   */
  it("never fetches the job page when the caller is out of quota", async () => {
    consume.mockRejectedValue(new ApiError(429, "ATS scan quota exceeded."));
    const next = vi.fn() as unknown as NextFunction;
    const { res } = responseSpy();

    await AtsAiController.analyze(requestFor(baseBody), res, next);

    expect(consume).toHaveBeenCalledTimes(1);
    expect(fetchJobPage).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
  });

  it("consumes quota before fetching, not after", async () => {
    const order: string[] = [];
    consume.mockImplementation(async () => {
      order.push("consume");
      return { tier: "free", limit: 2, used: 2, remaining: 0 };
    });
    fetchJobPage.mockImplementation(async () => {
      order.push("fetch");
      return "a job description long enough to score";
    });

    await AtsAiController.analyze(requestFor(baseBody), responseSpy().res, vi.fn());

    expect(order).toEqual(["consume", "fetch"]);
  });

  it("rejects a URL fetch request that supplies no URL, before spending anything", async () => {
    const next = vi.fn() as unknown as NextFunction;

    await AtsAiController.analyze(
      requestFor({ ...baseBody, jobUrl: undefined }),
      responseSpy().res,
      next,
    );

    expect(consume).not.toHaveBeenCalled();
    expect(fetchJobPage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it("does not touch the network when the caller pasted the description instead", async () => {
    await AtsAiController.analyze(
      requestFor({
        resume: baseBody.resume,
        requestId: baseBody.requestId,
        jobDescription: "pasted description",
        fetchJobUrl: false,
      }),
      responseSpy().res,
      vi.fn(),
    );

    expect(consume).toHaveBeenCalledTimes(1);
    expect(fetchJobPage).not.toHaveBeenCalled();
    expect(check).toHaveBeenCalledWith(baseBody.resume, "pasted description");
  });
});
