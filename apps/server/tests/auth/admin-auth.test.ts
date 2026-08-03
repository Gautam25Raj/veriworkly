import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("#config", () => ({
  config: {
    nodeEnv: "production",
    admin: { email: "admin@veriworkly.com" },
    auth: { sessionCacheMaxAgeSeconds: 300 },
  },
  isDevelopment: false,
}));

vi.mock("#lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("#lib/redis", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

const getSessionFromRequestHeaders = vi.fn();

vi.mock("#auth/index", () => ({
  convertNodeHeadersToWebHeaders: (headers: unknown) => headers,
  getSessionFromRequestHeaders: (headers: unknown) => getSessionFromRequestHeaders(headers),
}));

const findUnique = vi.fn();

vi.mock("#lib/prisma", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUnique(args) } },
}));

import { adminAuthMiddleware } from "#middleware/adminAuth";

function buildRequest() {
  return { headers: { cookie: "veriworkly-auth=session-token" } } as unknown as Request;
}

function buildResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  return res;
}

/**
 * The admin gate is the only thing standing between an authenticated session and the ability to
 * delete accounts and mint credits, so each of its refusal paths is asserted individually — a
 * single "happy path passes" test would not notice one of them silently inverting.
 */
describe("adminAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSessionFromRequestHeaders.mockResolvedValue({
      user: { id: "admin-id", email: "admin@veriworkly.com", name: "Admin" },
    });

    findUnique.mockResolvedValue({
      emailVerified: true,
      email: "admin@veriworkly.com",
      role: "ADMIN",
    });
  });

  it("admits the configured admin when their email is verified", async () => {
    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a session whose email is not the configured admin", async () => {
    getSessionFromRequestHeaders.mockResolvedValue({
      user: { id: "user-id", email: "someone@example.com", name: "Someone" },
    });

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects the admin email when the account's email is not verified", async () => {
    findUnique.mockResolvedValue({
      emailVerified: false,
      email: "admin@veriworkly.com",
      role: "ADMIN",
    });

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects when the session outlived the account row", async () => {
    findUnique.mockResolvedValue(null);

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects when the account's email no longer matches the session's", async () => {
    // An email change after the session was minted must not keep admin rights alive.
    findUnique.mockResolvedValue({
      emailVerified: true,
      email: "changed@example.com",
      role: "ADMIN",
    });

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("still admits the admin when the role column has not been promoted", async () => {
    // Nothing promotes the configured admin's row on first sign-in. Requiring role === ADMIN
    // here would lock the operator out of the very panel that sets roles.
    findUnique.mockResolvedValue({
      emailVerified: true,
      email: "admin@veriworkly.com",
      role: "USER",
    });

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an unauthenticated request", async () => {
    getSessionFromRequestHeaders.mockResolvedValue(null);

    const next = vi.fn();
    const res = buildResponse();

    await adminAuthMiddleware(buildRequest(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
