import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fluencySchema } from "@veriworkly/profile-core";

import { handleValidationError } from "#lib/errors";

/**
 * The zod 4 upgrade keeps zod 3's default messages (`#lib/zodMessages`): API clients get them in
 * `details`, and the API reference quotes them. Importing `#lib/errors` installs the map.
 */

function details(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected a validation failure");
  return handleValidationError(result.error).details;
}

function message(schema: z.ZodType, input: unknown) {
  return (details(schema, input) as Array<{ message: string }>)[0]?.message;
}

describe("zod 3 default messages on zod 4", () => {
  it("keeps the type messages", () => {
    expect(
      details(z.object({ items: z.array(z.object({ name: z.string() })) }), { items: [{}] }),
    ).toEqual([{ path: "items.0.name", message: "Required" }]);
    expect(message(z.string(), 4)).toBe("Expected string, received number");
    expect(message(z.number(), null)).toBe("Expected number, received null");
    expect(message(z.number().int(), 1.5)).toBe("Expected integer, received float");
    expect(message(z.object({}), [])).toBe("Expected object, received array");
  });

  it("keeps the size messages", () => {
    expect(message(z.string().min(1), "")).toBe("String must contain at least 1 character(s)");
    expect(message(z.string().max(2), "abc")).toBe("String must contain at most 2 character(s)");
    expect(message(z.string().length(2), "a")).toBe("String must contain exactly 2 character(s)");
    expect(message(z.array(z.string()).max(1), ["a", "b"])).toBe(
      "Array must contain at most 1 element(s)",
    );
    expect(message(z.array(z.string()).nonempty(), [])).toBe(
      "Array must contain at least 1 element(s)",
    );
    expect(message(z.number().min(1), 0)).toBe("Number must be greater than or equal to 1");
    expect(message(z.number().positive(), 0)).toBe("Number must be greater than 0");
    expect(message(z.number().int().max(10), 11)).toBe("Number must be less than or equal to 10");
  });

  it("keeps the string format messages", () => {
    expect(message(z.string().email(), "nope")).toBe("Invalid email");
    expect(message(z.string().url(), "nope")).toBe("Invalid url");
    expect(message(z.string().uuid(), "nope")).toBe("Invalid uuid");
    expect(message(z.string().datetime(), "nope")).toBe("Invalid datetime");
    expect(message(z.string().regex(/^a$/), "b")).toBe("Invalid");
    expect(message(z.string().startsWith("a"), "b")).toBe('Invalid input: must start with "a"');
  });

  it("keeps the enum, literal, key and union messages", () => {
    expect(message(z.enum(["a", "b"]), "c")).toBe(
      "Invalid enum value. Expected 'a' | 'b', received 'c'",
    );
    expect(message(z.literal("a"), "b")).toBe('Invalid literal value, expected "a"');
    expect(message(z.object({ a: z.string() }).strict(), { a: "x", b: 1, c: 2 })).toBe(
      "Unrecognized key(s) in object: 'b', 'c'",
    );
    expect(message(z.union([z.string(), z.number()]), true)).toBe("Invalid input");
    expect(
      message(
        z.string().refine(() => false),
        "x",
      ),
    ).toBe("Invalid input");
  });

  it("leaves explicit messages alone", () => {
    expect(message(z.string().min(1, "Name is required"), "")).toBe("Name is required");
    expect(message(z.string({ error: "custom" }), 1)).toBe("custom");
  });

  it("applies to profile-core schemas, which share the server's zod", () => {
    expect(message(fluencySchema, "bad")).toBe(
      "Invalid enum value. Expected 'elementary' | 'limited' | 'professional' | 'fluent' | 'native', received 'bad'",
    );
  });
});
