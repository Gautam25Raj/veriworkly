import { z } from "zod";

/**
 * Zod 3's default validation messages, kept on zod 4.
 *
 * Validation failures reach API clients as `details: [{ path, message }]`, and the messages a
 * schema does not set itself come from zod's locale. Zod 4 rewrote every one of them
 * ("Required" became "Invalid input: expected string, received undefined", "Invalid email"
 * became "Invalid email address", and so on). The published API reference quotes the zod 3
 * wording, and integrations match on it, so the upgrade keeps it: this map reproduces the zod 3
 * text for the issue codes the server's schemas can raise and defers to zod's own locale for
 * anything else.
 *
 * It is a global hook (`z.config`), installed once by `#lib/errors`, which every route that
 * turns a ZodError into a 400 already imports. Messages a schema sets explicitly still win:
 * zod consults this map only when neither the check nor the schema carries its own.
 */

type Issue = z.core.$ZodRawIssue;

function parsedType(input: unknown): string {
  if (input === undefined) return "undefined";
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  if (input instanceof Date) return "date";
  if (input instanceof Map) return "map";
  if (input instanceof Set) return "set";
  if (input instanceof Promise) return "promise";
  if (typeof input === "number") return Number.isNaN(input) ? "nan" : "number";
  if (typeof input === "object") return "object";
  return typeof input;
}

function joinValues(values: readonly unknown[], separator = " | "): string {
  return values
    .map((value) => (typeof value === "string" ? `'${value}'` : String(value)))
    .join(separator);
}

function schemaType(issue: Issue): string | undefined {
  return (issue.inst as { _zod?: { def?: { type?: string } } } | undefined)?._zod?.def?.type;
}

function bound(value: number | bigint, origin: string | undefined): string {
  return origin === "date" ? String(new Date(Number(value))) : value.toString();
}

const STRING_FORMAT_NAMES: Record<string, string> = {
  regex: "",
  ipv4: "ip",
  ipv6: "ip",
  cidrv4: "cidr",
  cidrv6: "cidr",
  uuidv4: "uuid",
  uuidv6: "uuid",
  uuidv7: "uuid",
  guid: "uuid",
};

function zod3Message(issue: Issue): string | undefined {
  switch (issue.code) {
    case "invalid_type": {
      const input = issue.input;
      if (input === undefined) return "Required";
      if (issue.expected === "date" && input instanceof Date) return "Invalid date";
      if (issue.expected === "int") {
        return `Expected integer, received ${typeof input === "number" ? "float" : parsedType(input)}`;
      }
      return `Expected ${issue.expected}, received ${parsedType(input)}`;
    }

    case "invalid_value": {
      const type = schemaType(issue);
      if (type === "literal" && issue.values.length === 1) {
        return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      }
      if (type === "enum") {
        if (typeof issue.input !== "string" && typeof issue.input !== "number") {
          return `Expected ${joinValues(issue.values)}, received ${parsedType(issue.input)}`;
        }
        return `Invalid enum value. Expected ${joinValues(issue.values)}, received '${String(issue.input)}'`;
      }
      return undefined;
    }

    case "too_small": {
      const min = bound(issue.minimum, issue.origin);
      switch (issue.origin) {
        case "array":
          return `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? "at least" : "more than"} ${min} element(s)`;
        case "string":
          return `String must contain ${issue.exact ? "exactly" : issue.inclusive ? "at least" : "over"} ${min} character(s)`;
        case "number":
        case "int":
        case "bigint":
          return `Number must be ${issue.exact ? "exactly equal to " : issue.inclusive ? "greater than or equal to " : "greater than "}${min}`;
        case "date":
          return `Date must be ${issue.exact ? "exactly equal to " : issue.inclusive ? "greater than or equal to " : "greater than "}${min}`;
        default:
          return "Invalid input";
      }
    }

    case "too_big": {
      const max = bound(issue.maximum, issue.origin);
      switch (issue.origin) {
        case "array":
          return `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? "at most" : "less than"} ${max} element(s)`;
        case "string":
          return `String must contain ${issue.exact ? "exactly" : issue.inclusive ? "at most" : "under"} ${max} character(s)`;
        case "number":
        case "int":
        case "bigint":
          return `Number must be ${issue.exact ? "exactly" : issue.inclusive ? "less than or equal to" : "less than"} ${max}`;
        case "date":
          return `Date must be ${issue.exact ? "exactly" : issue.inclusive ? "smaller than or equal to" : "smaller than"} ${max}`;
        default:
          return "Invalid input";
      }
    }

    case "invalid_format": {
      if (issue.format === "starts_with") return `Invalid input: must start with "${issue.prefix}"`;
      if (issue.format === "ends_with") return `Invalid input: must end with "${issue.suffix}"`;
      if (issue.format === "includes") return `Invalid input: must include "${issue.includes}"`;
      const name = STRING_FORMAT_NAMES[issue.format] ?? issue.format;
      return name ? `Invalid ${name}` : "Invalid";
    }

    case "not_multiple_of":
      return `Number must be a multiple of ${issue.divisor}`;

    case "unrecognized_keys":
      return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(", ")}`;

    case "invalid_union":
      // A discriminator miss already reads the zod 3 way in zod 4's locale.
      return "options" in issue && Array.isArray(issue.options) && issue.options.length > 0
        ? undefined
        : "Invalid input";

    case "custom":
      return "Invalid input";

    default:
      return undefined;
  }
}

let installed = false;

export function installZod3Messages() {
  if (installed) return;
  installed = true;
  z.config({ customError: zod3Message });
}
