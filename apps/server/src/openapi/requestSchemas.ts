import { z } from "zod";

import {
  HAND_WRITTEN_REQUESTS,
  OPENAPI_REQUEST_REGISTRY,
  type OperationRequestSchemas,
} from "#openapi/registry";

type JsonSchema = Record<string, unknown>;

type GeneratedParameter = {
  name: string;
  in: "path" | "query";
  required: boolean;
  schema: JsonSchema;
};

type GeneratedOperation = {
  parameters?: GeneratedParameter[];
  requestBody?: { schema: JsonSchema };
  readOutsideSchema?: OperationRequestSchemas["readOutsideSchema"];
};

type GeneratedRequests = {
  $comment: string;
  operations: Record<string, GeneratedOperation>;
  handWritten: Record<string, string>;
};

/**
 * What a client may send, as JSON Schema 2020-12 (the dialect of OpenAPI 3.1).
 *
 * `io: "input"` documents the accepted shape, not what a transform turns it into. Two cases the
 * built-in conversion cannot express get explicit treatment:
 * - `z.preprocess(fn, inner)` (blank query values treated as absent) is documented as `inner`;
 * - `z.date()` only ever arrives as JSON text, so it is an ISO date-time string.
 */
export function toRequestJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, {
    io: "input",
    target: "draft-2020-12",
    unrepresentable: "any",
    reused: "inline",
    cycles: "throw",
    override: (ctx) => {
      const def = ctx.zodSchema._zod.def;

      if (def.type === "date") {
        ctx.jsonSchema.type = "string";
        ctx.jsonSchema.format = "date-time";
      }

      if (def.type === "pipe" && def.in._zod.def.type === "transform") {
        for (const key of Object.keys(ctx.jsonSchema)) delete ctx.jsonSchema[key];
        Object.assign(ctx.jsonSchema, toRequestJsonSchema(def.out as z.ZodType));
      }
    },
  }) as JsonSchema;

  delete json.$schema;
  return tidy(json) as JsonSchema;
}

const SAFE_INTEGER_BOUND = Number.MAX_SAFE_INTEGER;

/**
 * Drops conversion noise a reader of the reference does not need: the regex zod pairs with every
 * string `format`, the ±2^53 bounds `.int()` adds, `propertyNames: string` on records (JSON keys
 * are always strings), nested `anyOf`s and identical `anyOf` branches.
 */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy);
  if (!node || typeof node !== "object") return node;

  const schema = Object.fromEntries(
    Object.entries(node as JsonSchema).map(([key, value]) => [key, tidy(value)]),
  );

  if (typeof schema.format === "string") delete schema.pattern;
  if (schema.maximum === SAFE_INTEGER_BOUND) delete schema.maximum;
  if (schema.minimum === -SAFE_INTEGER_BOUND) delete schema.minimum;
  if (JSON.stringify(schema.propertyNames) === '{"type":"string"}') delete schema.propertyNames;

  if (Array.isArray(schema.anyOf)) {
    const branches = (schema.anyOf as JsonSchema[]).flatMap((branch) =>
      Object.keys(branch).length === 1 && Array.isArray(branch.anyOf)
        ? (branch.anyOf as JsonSchema[])
        : [branch],
    );
    const seen = new Set<string>();
    schema.anyOf = branches.filter((branch) => {
      const key = JSON.stringify(branch);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return schema;
}

function toParameters(schema: z.ZodType, location: "path" | "query"): GeneratedParameter[] {
  const json = toRequestJsonSchema(schema);
  const properties = json.properties as Record<string, JsonSchema> | undefined;

  if (json.type !== "object" || !properties) {
    throw new Error(`A ${location} schema must be a z.object, got ${JSON.stringify(json)}`);
  }

  const required = new Set((json.required as string[] | undefined) ?? []);

  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.has(name),
    schema: property,
  }));
}

export function buildRequestSchemas(): GeneratedRequests {
  const operations: Record<string, GeneratedOperation> = {};

  for (const [operation, entry] of Object.entries(OPENAPI_REQUEST_REGISTRY)) {
    const generated: GeneratedOperation = {};
    const parameters = [
      ...(entry.params ? toParameters(entry.params, "path") : []),
      ...(entry.query ? toParameters(entry.query, "query") : []),
    ];

    if (parameters.length > 0) generated.parameters = parameters;
    if (entry.body) generated.requestBody = { schema: toRequestJsonSchema(entry.body) };
    if (entry.readOutsideSchema) generated.readOutsideSchema = entry.readOutsideSchema;

    operations[operation] = generated;
  }

  return {
    $comment:
      "Generated from the server's zod validators by `npm run generate:openapi -w @veriworkly/server` (apps/server/src/openapi/registry.ts). Do not edit.",
    operations,
    handWritten: HAND_WRITTEN_REQUESTS,
  };
}
