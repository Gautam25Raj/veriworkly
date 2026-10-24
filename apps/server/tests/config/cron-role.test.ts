import { describe, expect, it } from "vitest";

import { parseCronRole } from "#config/cronRole";

describe("parseCronRole", () => {
  it.each([
    [undefined, "all"],
    ["", "all"],
    [" ALL ", "all"],
    ["all", "all"],
    ["none", "none"],
    ["NONE", "none"],
  ] as const)("parses %j as %s", (raw, expected) => {
    expect(parseCronRole(raw)).toBe(expected);
  });

  it.each(["worker1", "true", "0"])("throws on the invalid value %j", (raw) => {
    expect(() => parseCronRole(raw)).toThrow(/Invalid CRON_ROLE/);
  });
});
