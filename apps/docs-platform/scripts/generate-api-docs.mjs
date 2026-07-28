/**
 * Builds the API reference from the modular OpenAPI spec, in two steps:
 *
 *   1. Bundle  `specs/openapi.yaml` (+ `specs/paths/*`, `specs/components/*`) -> `openapi.yaml`
 *   2. Generate `openapi.yaml` -> `content/api-reference/**\/*.mdx`
 *
 * Runs automatically before `dev` and `build` (see the `predev` / `prebuild` scripts), so the
 * published reference can never drift from the spec. Edit files under `specs/` — never the
 * bundled `openapi.yaml` or the generated `.mdx` pages, both of which are overwritten here.
 *
 * Step 1 replaces `npx @redocly/cli bundle`: it resolves every external `$ref` and rewrites
 * component pointers to local `#/components/{schemas,responses}/Name` form, which is byte-for-byte
 * what Redocly emitted, without requiring a network install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const specsDir = path.join(appRoot, "specs");
const bundlePath = path.join(appRoot, "openapi.yaml");
const outputDir = path.join(appRoot, "content/api-reference");

/* ------------------------------------------------------------------ bundle */

const cache = new Map();

function load(file) {
  const abs = path.resolve(file);
  if (!cache.has(abs)) cache.set(abs, YAML.parse(fs.readFileSync(abs, "utf8")));
  return cache.get(abs);
}

function pointer(doc, fragment) {
  const trimmed = (fragment ?? "").replace(/^#/, "").replace(/^\//, "");
  if (!trimmed) return doc;

  return trimmed.split("/").reduce((acc, key) => {
    if (acc == null) throw new Error(`Unresolvable $ref segment "${key}" in "${fragment}"`);
    return acc[key.replace(/~1/g, "/").replace(/~0/g, "~")];
  }, doc);
}

/** Rewrites a cross-file component `$ref` into the local pointer the bundle uses. */
function localRef(target) {
  const [file, fragment] = target.split("#");
  const name = (fragment ?? "").replace(/^\//, "");

  // No fragment means "inline this whole file" — that is how `components.schemas` is wired.
  if (!name) return null;

  const base = path.basename(file);
  if (base === "schemas.yaml") return `#/components/schemas/${name}`;
  if (base === "responses.yaml") return `#/components/responses/${name}`;
  return null;
}

/** The component namespace a file's own `#/Name` refs belong to once inlined. */
function selfPrefixFor(file) {
  const base = path.basename(file);
  if (base === "schemas.yaml") return "#/components/schemas/";
  if (base === "responses.yaml") return "#/components/responses/";
  return null;
}

function resolve(node, baseDir, selfPrefix) {
  if (Array.isArray(node)) return node.map((item) => resolve(item, baseDir, selfPrefix));
  if (node === null || typeof node !== "object") return node;

  const keys = Object.keys(node);
  const siblings = () =>
    resolve(
      Object.fromEntries(keys.filter((k) => k !== "$ref").map((k) => [k, node[k]])),
      baseDir,
      selfPrefix,
    );

  if (typeof node.$ref === "string") {
    // A file-internal ref inside an inlined component file must be re-namespaced.
    if (node.$ref.startsWith("#")) {
      if (!selfPrefix) {
        return Object.fromEntries(keys.map((k) => [k, resolve(node[k], baseDir, selfPrefix)]));
      }
      return { $ref: selfPrefix + node.$ref.replace(/^#\/?/, ""), ...siblings() };
    }

    const rewritten = localRef(node.$ref);
    if (rewritten) return { $ref: rewritten, ...siblings() };

    // Anything else (a path entry, or a whole component file) is inlined.
    const [file, fragment] = node.$ref.split("#");
    const abs = path.resolve(baseDir, file);
    return resolve(pointer(load(abs), fragment), path.dirname(abs), selfPrefixFor(abs));
  }

  return Object.fromEntries(keys.map((key) => [key, resolve(node[key], baseDir, selfPrefix)]));
}

/** Fails loudly rather than shipping a reference with dangling pointers. */
function assertRefsResolve(document) {
  const dangling = [];

  (function walk(node, at) {
    if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${at}/${i}`));
    if (!node || typeof node !== "object") return;

    if (typeof node.$ref === "string") {
      if (!node.$ref.startsWith("#")) {
        dangling.push(`${at} -> ${node.$ref} (unresolved external ref)`);
        return;
      }
      let cursor = document;
      for (const segment of node.$ref.slice(2).split("/")) cursor = cursor?.[segment];
      if (cursor === undefined) dangling.push(`${at} -> ${node.$ref}`);
      return;
    }

    for (const key of Object.keys(node)) walk(node[key], `${at}/${key}`);
  })(document, "");

  if (dangling.length > 0) {
    throw new Error(`Bundled spec has ${dangling.length} broken $ref(s):\n  ${dangling.join("\n  ")}`);
  }
}

const bundled = resolve(load(path.join(specsDir, "openapi.yaml")), specsDir, null);
assertRefsResolve(bundled);

fs.writeFileSync(bundlePath, YAML.stringify(bundled, { lineWidth: 0 }), "utf8");

const pathCount = Object.keys(bundled.paths ?? {}).length;
const schemaCount = Object.keys(bundled.components?.schemas ?? {}).length;
console.log(`[api-docs] bundled ${pathCount} paths and ${schemaCount} schemas -> openapi.yaml`);

/* ---------------------------------------------------------------- generate */

// Generated pages are fully derived from the spec, so clear them first: a renamed or removed
// operation would otherwise leave an orphaned page behind. Hand-written `overview.mdx` files and
// the `meta.json` navigation are authored by us and must survive.
for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const dir = path.join(outputDir, entry.name);
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".mdx") && file !== "overview.mdx") fs.rmSync(path.join(dir, file));
  }
}

await generateFiles({
  input: createOpenAPI({ input: [bundlePath], proxyUrl: "/api/proxy" }),
  output: outputDir,
  per: "operation",
  groupBy: "tag",
});

console.log("[api-docs] generated MDX pages -> content/api-reference");
