import { describe, expect, it } from "vitest";

import { hasWellFormedHostAndProto } from "#utils/requestOrigin";

describe("hasWellFormedHostAndProto (V-155)", () => {
  it("accepts ordinary hosts with and without ports, and forwarded https", () => {
    expect(hasWellFormedHostAndProto({ host: "api.veriworkly.com" })).toBe(true);
    expect(hasWellFormedHostAndProto({ host: "localhost:8080" })).toBe(true);
    expect(hasWellFormedHostAndProto({ host: "api:8080" })).toBe(true);
    expect(hasWellFormedHostAndProto({ host: "[::1]:8080" })).toBe(true);
    expect(
      hasWellFormedHostAndProto({ host: "api.veriworkly.com", "x-forwarded-proto": "https" }),
    ).toBe(true);
    expect(
      hasWellFormedHostAndProto({ host: "api.veriworkly.com", "x-forwarded-proto": "https, http" }),
    ).toBe(true);
  });

  it("refuses the inputs that make `new Request()` throw", () => {
    expect(hasWellFormedHostAndProto({ host: "a:99999" })).toBe(false);
    expect(hasWellFormedHostAndProto({ host: "" })).toBe(false);
    expect(hasWellFormedHostAndProto({})).toBe(false);
    expect(hasWellFormedHostAndProto({ host: "a b" })).toBe(false);
    expect(
      hasWellFormedHostAndProto({ host: "api.veriworkly.com", "x-forwarded-proto": "ftp" }),
    ).toBe(false);
    expect(
      hasWellFormedHostAndProto({ host: "api.veriworkly.com", "x-forwarded-proto": "javascript" }),
    ).toBe(false);
  });

  it("refuses a Host that smuggles credentials or a path", () => {
    expect(hasWellFormedHostAndProto({ host: "user:pw@evil.com" })).toBe(false);
    expect(hasWellFormedHostAndProto({ host: "evil.com/path" })).toBe(false);
    expect(hasWellFormedHostAndProto({ host: "evil.com?x=1" })).toBe(false);
  });
});
