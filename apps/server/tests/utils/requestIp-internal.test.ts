import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";

import { getRequestIpDetails, matchesSharedSecret } from "../../src/utils/requestIp.js";

const { INTERNAL_KEY } = vi.hoisted(() => ({
  INTERNAL_KEY: "internal-api-key-0123456789abcdef0123456789",
}));

vi.mock("#config", () => ({ config: { internal: { apiKey: INTERNAL_KEY } } }));

function requestWith(headers: Record<string, string>): Request {
  return { ip: "10.0.0.5", headers, socket: { remoteAddress: "10.0.0.5" } } as unknown as Request;
}

describe("x-forwarded-client-ip (V-151)", () => {
  it("is used as the client IP when x-internal-key matches INTERNAL_API_KEY", () => {
    const details = getRequestIpDetails(
      requestWith({ "x-internal-key": INTERNAL_KEY, "x-forwarded-client-ip": "203.0.113.7" }),
    );
    expect(details.resolvedIp).toBe("203.0.113.7");
  });

  it("is ignored without the key, with a wrong key, or when it is not an IP", () => {
    expect(
      getRequestIpDetails(requestWith({ "x-forwarded-client-ip": "203.0.113.7" })).resolvedIp,
    ).toBe("10.0.0.5");
    expect(
      getRequestIpDetails(
        requestWith({ "x-internal-key": "wrong", "x-forwarded-client-ip": "203.0.113.7" }),
      ).resolvedIp,
    ).toBe("10.0.0.5");
    expect(
      getRequestIpDetails(
        requestWith({ "x-internal-key": INTERNAL_KEY, "x-forwarded-client-ip": "not-an-ip" }),
      ).resolvedIp,
    ).toBe("10.0.0.5");
  });
});

describe("matchesSharedSecret", () => {
  it("matches only the exact configured secret and never an unset one", () => {
    expect(matchesSharedSecret("abc", "abc")).toBe(true);
    expect(matchesSharedSecret("abcd", "abc")).toBe(false);
    expect(matchesSharedSecret("", "")).toBe(false);
    expect(matchesSharedSecret("anything", "")).toBe(false);
    expect(matchesSharedSecret(undefined, "abc")).toBe(false);
    expect(matchesSharedSecret(["abc"], "abc")).toBe(false);
  });
});
