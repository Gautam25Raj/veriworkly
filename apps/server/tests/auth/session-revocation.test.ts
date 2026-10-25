import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const deleteSessionsMock = vi.fn();
const cacheDelMock = vi.fn();

const AUTH_SECRET = "unit-test-auth-secret";

vi.mock("#config", () => ({
  config: { nodeEnv: "test", auth: { secret: AUTH_SECRET } },
}));

vi.mock("#lib/prisma", () => ({
  prisma: { session: { findMany: findManyMock } },
}));

vi.mock("#lib/redis", () => ({
  cacheDel: cacheDelMock,
}));

vi.mock("#lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("#auth/index", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: { deleteSessions: deleteSessionsMock },
    }),
  },
}));

// `#utils/authCache` is deliberately NOT mocked: the point of these tests is that the key the
// revocation path deletes is the key the request path reads. Mocking it made the suite pass
// while the two hashed different strings and revoked sessions stayed authenticated.
const { getSessionCacheKey } = await import("#utils/authCache");
const { revokeAllSessionsForUser, revokeAllSessionsForUserSafely } = await import("#auth/sessions");

/** The cookie a browser actually sends: better-call's `encodeURIComponent(token.base64(HMAC))`. */
function signedCookie(token: string, name = "veriworkly-auth.session_token") {
  const signature = createHmac("sha256", AUTH_SECRET).update(token).digest("base64");
  return `${name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

/**
 * Regression cover for the bug where admin "revoke sessions" deleted only the Postgres row.
 * better-auth's findSession reads its Redis secondary storage first and returns without ever
 * querying the database, so a DB-only delete left the user authenticated for the full session
 * TTL (30 days by default). Each assertion below pins one of the three stores that must be
 * cleared; dropping any one of them silently restores the vulnerability.
 */
describe("revokeAllSessionsForUser", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    deleteSessionsMock.mockReset();
    cacheDelMock.mockReset();
  });

  it("clears better-auth secondary storage, the active-sessions index, and the app session cache", async () => {
    findManyMock.mockResolvedValue([{ token: "token-a" }, { token: "token-b" }]);

    const revoked = await revokeAllSessionsForUser("user-1");

    expect(revoked).toBe(2);

    // 1. better-auth's per-token Redis entries + the DB rows.
    expect(deleteSessionsMock).toHaveBeenCalledWith(["token-a", "token-b"]);

    // 2. The active-sessions index, which the *plural* deleteSessions does not prune itself.
    expect(cacheDelMock).toHaveBeenCalledWith("active-sessions-user-1");

    // 3. This app's own auth:session:<token-hash> cache — the SAME key the request path builds
    //    from the signed cookie, with the real signature check and hashing on both sides.
    const deletedKeys = cacheDelMock.mock.calls.map(([key]) => key as string);

    expect(deletedKeys).toContain(getSessionCacheKey(signedCookie("token-a")));
    expect(deletedKeys).toContain(getSessionCacheKey(signedCookie("token-b")));
    expect(deletedKeys.filter((key) => key.startsWith("auth:session:"))).toHaveLength(2);
  });

  it("no-ops without touching any store when the user has no sessions", async () => {
    findManyMock.mockResolvedValue([]);

    await expect(revokeAllSessionsForUser("user-1")).resolves.toBe(0);

    expect(deleteSessionsMock).not.toHaveBeenCalled();
    expect(cacheDelMock).not.toHaveBeenCalled();
  });

  it("swallows failures in the safe variant so account deletion is never blocked", async () => {
    findManyMock.mockRejectedValue(new Error("redis down"));

    await expect(revokeAllSessionsForUserSafely("user-1")).resolves.toBeUndefined();
  });

  it("propagates failures in the strict variant so an admin sees a failed revocation", async () => {
    findManyMock.mockRejectedValue(new Error("redis down"));

    await expect(revokeAllSessionsForUser("user-1")).rejects.toThrow("redis down");
  });
});
