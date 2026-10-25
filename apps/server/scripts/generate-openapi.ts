/**
 * Writes the request half of the API reference from the server's zod validators (IMPROVEMENTS 14):
 * `apps/docs-platform/specs/generated/requests.json`, which the docs build
 * (`npm run generate:api -w @veriworkly/docs-platform`) merges into the hand-written spec.
 *
 * Run it after changing a public validator or `src/openapi/registry.ts`, then run generate:api.
 * `tests/openapi/request-schemas.test.ts` and CI fail while the committed file is stale.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as prettier from "prettier";

import { buildRequestSchemas } from "#openapi/requestSchemas";

export const GENERATED_REQUESTS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs-platform/specs/generated/requests.json",
);

const text = await prettier.format(JSON.stringify(buildRequestSchemas()), {
  ...(await prettier.resolveConfig(GENERATED_REQUESTS_PATH)),
  filepath: GENERATED_REQUESTS_PATH,
});

const current = fs.existsSync(GENERATED_REQUESTS_PATH)
  ? fs.readFileSync(GENERATED_REQUESTS_PATH, "utf8")
  : null;

if (current === text) {
  console.log(`[openapi] ${path.relative(process.cwd(), GENERATED_REQUESTS_PATH)} is up to date`);
} else {
  fs.mkdirSync(path.dirname(GENERATED_REQUESTS_PATH), { recursive: true });
  fs.writeFileSync(GENERATED_REQUESTS_PATH, text, "utf8");
  console.log(`[openapi] wrote ${path.relative(process.cwd(), GENERATED_REQUESTS_PATH)}`);
}
