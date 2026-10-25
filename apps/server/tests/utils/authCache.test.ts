import { createHmac, randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

const AUTH_SECRET = "unit-test-auth-secret";

vi.mock("#lib/redis", () => ({ cacheDel: vi.fn() }));
vi.mock("#config", () => ({ config: { nodeEnv: "test", auth: { secret: AUTH_SECRET } } }));

const { extractSessionTokenFromCookieHeader, getSessionCacheKey, sessionCacheKeyForToken } =
  await import("#utils/authCache");

/** better-call's `signCookieValue`: `encodeURIComponent(token.base64(HMAC-SHA256(secret, token)))`. */
function sign(token: string, secret = AUTH_SECRET) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

const PLAIN = "veriworkly-auth.session_token";
const SECURE = "__Secure-veriworkly-auth.session_token";

describe("extractSessionTokenFromCookieHeader", () => {
  it("returns the token from a cookie whose signature verifies with the configured secret", () => {
    const token = randomBytes(32).toString("base64url");

    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=${sign(token)}`)).toBe(token);
    expect(extractSessionTokenFromCookieHeader(`theme=dark; ${PLAIN}=${sign(token)}; x=1`)).toBe(
      token,
    );
  });

  it("rejects an unsigned value, a forged signature and a signature made with another secret", () => {
    const token = randomBytes(32).toString("base64url");
    const garbage = Buffer.alloc(32, 7).toString("base64");

    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=${token}`)).toBeNull();
    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=token-1`)).toBeNull();
    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=${token}.${garbage}`)).toBeNull();
    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=${token}.`)).toBeNull();
    expect(
      extractSessionTokenFromCookieHeader(`${PLAIN}=${sign(token, "other-secret")}`),
    ).toBeNull();
    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=%E0%A4%A`)).toBeNull();
  });

  it("ignores other cookies, including the session_data cookie-cache cookie", () => {
    expect(extractSessionTokenFromCookieHeader("veriworkly-auth.session_data=eyJ.abc")).toBeNull();
    expect(extractSessionTokenFromCookieHeader("veriworkly-auth=session-token")).toBeNull();
    expect(extractSessionTokenFromCookieHeader("")).toBeNull();
    expect(extractSessionTokenFromCookieHeader(undefined)).toBeNull();
    expect(extractSessionTokenFromCookieHeader(`${PLAIN}=`)).toBeNull();
  });

  it("outside production reads only the plain cookie name", () => {
    const token = randomBytes(32).toString("base64url");

    expect(extractSessionTokenFromCookieHeader(`${SECURE}=${sign(token)}`)).toBeNull();
  });
});

describe("getSessionCacheKey", () => {
  it("is the same key for the signed cookie and for the bare token", () => {
    const token = randomBytes(32).toString("base64url");
    const fromToken = sessionCacheKeyForToken(token);

    expect(fromToken).toMatch(/^auth:session:[a-f0-9]{64}$/);
    expect(getSessionCacheKey(`${PLAIN}=${sign(token)}`)).toBe(fromToken);
    expect(getSessionCacheKey(`${PLAIN}=${token}`)).toBeNull();
  });
});

describe("in production", () => {
  afterEach(() => {
    vi.doUnmock("#config");
    vi.resetModules();
  });

  it("reads only the __Secure- cookie; an injected plain-name cookie cannot pick the entry", async () => {
    vi.resetModules();
    vi.doMock("#config", () => ({
      config: { nodeEnv: "production", auth: { secret: AUTH_SECRET } },
    }));

    const prod = await import("#utils/authCache");
    const token = randomBytes(32).toString("base64url");
    const other = randomBytes(32).toString("base64url");

    expect(prod.extractSessionTokenFromCookieHeader(`${SECURE}=${sign(token)}`)).toBe(token);
    expect(prod.extractSessionTokenFromCookieHeader(`${PLAIN}=${sign(token)}`)).toBeNull();
    expect(
      prod.extractSessionTokenFromCookieHeader(`${PLAIN}=${sign(other)}; ${SECURE}=${sign(token)}`),
    ).toBe(token);
  });
});
