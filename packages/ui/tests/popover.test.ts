import { describe, expect, it } from "vitest";

import { supportsPopover } from "../src/lib/popover";

describe("supportsPopover", () => {
  it("is false, without throwing, where the Popover API is missing", () => {
    expect(() => supportsPopover({})).not.toThrow();
    expect(supportsPopover({})).toBe(false);
    expect(supportsPopover({ showPopover: undefined })).toBe(false);
  });

  it("is true where showPopover exists", () => {
    expect(supportsPopover({ showPopover() {} })).toBe(true);
  });
});
