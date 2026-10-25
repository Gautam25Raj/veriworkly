import { beforeEach, describe, expect, it, vi } from "vitest";
import { flexibleAuth } from "#middleware/flexibleAuth";
import type { Request, Response, NextFunction } from "express";
import { getSessionUserFromRequest } from "#middleware/auth";
import { apiKeyAuth } from "#middleware/apiKeyAuth";
import { apiKeyRateLimit } from "#middleware/apiKeyRateLimit";

vi.mock("#config", () => ({
  config: {
    allowedOrigins: ["https://trusted.example.com"],
  },
  isDevelopment: false,
}));

vi.mock("#middleware/apiKeyAuth", () => ({
  // Async like the real middleware: flexibleAuth awaits it and catches its promise.
  apiKeyAuth: vi.fn(async (req, res, next) => next()),
}));

vi.mock("#middleware/auth", () => ({
  getSessionUserFromRequest: vi.fn().mockResolvedValue(null),
}));

vi.mock("#middleware/apiKeyRateLimit", () => ({
  // Async like the real middleware: flexibleAuth awaits it and catches its promise.
  apiKeyRateLimit: vi.fn(async (req, res, next) => next()),
}));

describe("flexibleAuth middleware", () => {
  let req: Partial<Request> & { headers: Record<string, string> };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.mocked(getSessionUserFromRequest).mockResolvedValue(null);
    vi.mocked(apiKeyAuth).mockClear();
    vi.mocked(apiKeyRateLimit).mockClear();
    req = {
      headers: {},
      ip: "192.168.1.1",
      path: "/test-route",
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("passes for exact allowed origin", async () => {
    req.headers.origin = "https://trusted.example.com";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("passes for portfolio subdomain origins", async () => {
    req.headers.origin = "https://alice.veriworkly.com";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects malicious origin prefix-matching", async () => {
    req.headers.origin = "https://trusted.example.com.attacker.com";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects malicious origin suffix-injections", async () => {
    req.headers.origin = "https://trusted.example.attacker.example";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects headerless requests (no origin/referer)", async () => {
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    // V-136: the standard error envelope, with the old `code` kept under `details`.
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 401,
        details: { code: "API_KEY_REQUIRED" },
      }),
    );
  });

  it("validates API keys before origin checks", async () => {
    req.headers["x-api-key"] = "vw_valid";

    await flexibleAuth({ skipSession: true })(req as Request, res as Response, next);

    expect(apiKeyAuth).toHaveBeenCalled();
    expect(apiKeyRateLimit).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("validates bearer API keys before origin checks", async () => {
    req.headers.authorization = "Bearer vw_valid";

    await flexibleAuth({ skipSession: true })(req as Request, res as Response, next);

    expect(apiKeyAuth).toHaveBeenCalled();
    expect(apiKeyRateLimit).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("passes headerless requests when a valid session cookie is present", async () => {
    req.headers.cookie = "veriworkly-auth=abc123";
    vi.mocked(getSessionUserFromRequest).mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: "User",
    });

    await flexibleAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects headerless requests when a session cookie is present but invalid", async () => {
    req.headers.cookie = "veriworkly-auth=abc123";
    vi.mocked(getSessionUserFromRequest).mockResolvedValue(null);

    await flexibleAuth(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, details: { code: "AUTH_REQUIRED" } }),
    );
  });

  it("passes for exact referer origin", async () => {
    req.headers.referer = "https://trusted.example.com/dashboard";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects invalid referer origin", async () => {
    req.headers.referer = "https://trusted.example.attacker.com/dashboard";
    await flexibleAuth(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
