import { describe, expect, it } from "vitest";

import { parseIntegerEnv } from "../../src/config/parseEnv.js";

describe("parseIntegerEnv", () => {
  it.each([
    [undefined, 7],
    ["", 7],
    ["   ", 7],
    ["abc", 7],
    ["12abc", 7],
    ["1.5", 7],
    ["NaN", 7],
    ["Infinity", 7],
    ["1e3", 7],
    ["42", 42],
    [" 42 ", 42],
    ["0", 0],
    ["-3", -3],
  ])("parseIntegerEnv(%j, 7) === %j", (value, expected) => {
    expect(parseIntegerEnv(value, 7)).toBe(expected);
  });
});
