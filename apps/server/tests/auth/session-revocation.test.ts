import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const deleteSessionsMock = vi.fn();
const cacheDelMock = vi.fn();
const invalidateCacheByTokenMock = vi.fn();

vi.mock("#lib/prisma", () => ({
  prisma: { session: { findMany: findManyMock } },
}));

vi.mock("#lib/redis", () => ({
  cacheDel: cacheDelMock,
}));

vi.mock("#lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("#utils/authCache", () => ({
  invalidateCacheByToken: invalidateCacheByTokenMock,
}));

vi.mock("#auth/index", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: { deleteSessions: deleteSessionsMock },
    }),
  },
}));

const { revokeAllSessionsForUser, revokeAllSessionsForUserSafely } = await import(
  "#auth/sessions"
);

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
    invalidateCacheByTokenMock.mockReset();
  });

  it("clears better-auth secondary storage, the active-sessions index, and the app session cache", async () => {
    findManyMock.mockResolvedValue([{ token: "token-a" }, { token: "token-b" }]);

    const revoked = await revokeAllSessionsForUser("user-1");

    expect(revoked).toBe(2);

    // 1. better-auth's per-token Redis entries + the DB rows.
    expect(deleteSessionsMock).toHaveBeenCalledWith(["token-a", "token-b"]);

    // 2. The active-sessions index, which the *plural* deleteSessions does not prune itself.
    expect(cacheDelMock).toHaveBeenCalledWith("active-sessions-user-1");

    // 3. This app's own auth:session:<cookie-hash> cache, one entry per token.
    expect(invalidateCacheByTokenMock).toHaveBeenCalledWith("token-a");
    expect(invalidateCacheByTokenMock).toHaveBeenCalledWith("token-b");
  });

  it("no-ops without touching any store when the user has no sessions", async () => {
    findManyMock.mockResolvedValue([]);

    await expect(revokeAllSessionsForUser("user-1")).resolves.toBe(0);

    expect(deleteSessionsMock).not.toHaveBeenCalled();
    expect(cacheDelMock).not.toHaveBeenCalled();
    expect(invalidateCacheByTokenMock).not.toHaveBeenCalled();
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
