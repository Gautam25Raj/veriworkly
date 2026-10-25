import { createHash, createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheGetMock = vi.fn();
const cacheSetMock = vi.fn();
const cacheDelMock = vi.fn();
const getSessionMock = vi.fn();

const AUTH_SECRET = "unit-test-auth-secret";

vi.mock("#config", () => ({
  config: {
    nodeEnv: "test",
    auth: {
      secret: AUTH_SECRET,
      sessionCacheMaxAgeSeconds: 123,
    },
  },
}));

vi.mock("#lib/redis", () => ({
  cacheGet: cacheGetMock,
  cacheSet: cacheSetMock,
  cacheDel: cacheDelMock,
}));

vi.mock("#auth/index", () => ({
  convertNodeHeadersToWebHeaders: (headers: unknown) => headers,
  getSessionFromRequestHeaders: getSessionMock,
}));

/**
 * A real cookie value, signed the way better-call signs it (`better-call/dist/crypto.mjs`,
 * `signCookieValue`): `encodeURIComponent(`${token}.${base64(HMAC-SHA256(secret, token))}`)`.
 * The earlier version of this test used a bare `token-1`, which is a cookie no browser ever
 * sends, and so never noticed that the cache key built from a signed cookie could not be
 * matched by `invalidateCacheByToken`.
 */
function signedCookie(token: string, name = "veriworkly-auth.session_token") {
  const signature = createHmac("sha256", AUTH_SECRET).update(token).digest("base64");
  return `${name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

function expectedKey(token: string) {
  return `auth:session:${createHash("sha256").update(token).digest("hex")}`;
}

describe("session auth cache", () => {
  beforeEach(() => {
    cacheGetMock.mockReset();
    cacheSetMock.mockReset();
    cacheDelMock.mockReset();
    getSessionMock.mockReset();
  });

  it("caches under a key derived from the token only, with the configured TTL", async () => {
    cacheGetMock.mockResolvedValue(null);
    getSessionMock.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User" },
    });

    const { getSessionUserFromRequest } = await import("#middleware/auth");

    const token = "AbC123tokenWithNoDots";
    const user = await getSessionUserFromRequest({
      headers: { cookie: `other=1; ${signedCookie(token)}; veriworkly-auth.session_data=x` },
    } as never);

    expect(user?.id).toBe("user-1");
    expect(cacheGetMock).toHaveBeenCalledWith(expectedKey(token));
    expect(cacheSetMock).toHaveBeenCalledWith(
      expectedKey(token),
      { id: "user-1", email: "user@example.com", name: "User" },
      123,
    );
  });

  it("invalidateCacheByToken deletes exactly the key the signed cookie was cached under", async () => {
    const { getSessionCacheKey, invalidateCacheByToken } = await import("#utils/authCache");

    const token = "AbC123tokenWithNoDots";

    expect(getSessionCacheKey(signedCookie(token))).toBe(expectedKey(token));

    await invalidateCacheByToken(token);

    expect(cacheDelMock).toHaveBeenCalledTimes(1);
    expect(cacheDelMock).toHaveBeenCalledWith(expectedKey(token));
  });
});
