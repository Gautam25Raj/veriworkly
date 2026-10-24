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
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";
import * as prettier from "prettier";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const specsDir = path.join(appRoot, "specs");
const bundlePath = path.join(appRoot, "openapi.yaml");
const outputDir = path.join(appRoot, "content/api-reference");

// Served at /openapi.json and /openapi.yaml, and advertised by `llms.txt` and the agent card.
// Written from the same bundle as the MDX pages — they were hand-maintained once and drifted.
// This is the only copy: the other apps redirect their /openapi.json here.
const publicJsonPath = path.join(appRoot, "public/openapi.json");
const publicYamlPath = path.join(appRoot, "public/openapi.yaml");

/* ------------------------------------------------------------------ bundle */

const cache = new Map();

function load(file) {
  const abs = path.resolve(file);
  if (!cache.has(abs)) cache.set(abs, YAML.parse(fs.readFileSync(abs, "utf8")));
  return cache.get(abs);
}

const unescapeSegment = (key) => key.replace(/~1/g, "/").replace(/~0/g, "~");

function pointer(doc, fragment) {
  const trimmed = (fragment ?? "").replace(/^#/, "").replace(/^\//, "");
  if (!trimmed) return doc;

  return trimmed.split("/").reduce((acc, key) => {
    const name = unescapeSegment(key);
    const next = acc == null ? undefined : acc[name];

    // A missing last segment used to return undefined, which dropped the whole path from the
    // bundle and then deleted its page, with no error.
    if (next === undefined) throw new Error(`Unresolvable $ref "${fragment}": no "${name}"`);
    return next;
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

/** `file#fragment` keys currently being inlined, to turn a circular inline into a clear error. */
const inlining = [];

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
    const key = `${abs}#${fragment ?? ""}`;

    if (inlining.includes(key)) {
      throw new Error(`Circular $ref while inlining: ${[...inlining, key].join(" -> ")}`);
    }

    // Resolved before the key goes on the stack, so a sibling that points at the same target is not
    // mistaken for a cycle.
    const extra = siblings();

    inlining.push(key);
    try {
      const inlined = resolve(pointer(load(abs), fragment), path.dirname(abs), selfPrefixFor(abs));

      // Keys written next to the $ref (a summary, say) belong to the referencing file; keep them.
      return Object.keys(extra).length > 0 && inlined && typeof inlined === "object"
        ? { ...inlined, ...extra }
        : inlined;
    } finally {
      inlining.pop();
    }
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
      for (const segment of node.$ref.slice(2).split("/"))
        cursor = cursor?.[unescapeSegment(segment)];
      if (cursor === undefined) dangling.push(`${at} -> ${node.$ref}`);
      return;
    }

    for (const key of Object.keys(node)) walk(node[key], `${at}/${key}`);
  })(document, "");

  if (dangling.length > 0) {
    throw new Error(
      `Bundled spec has ${dangling.length} broken $ref(s):\n  ${dangling.join("\n  ")}`,
    );
  }
}

const bundled = resolve(load(path.join(specsDir, "openapi.yaml")), specsDir, null);
assertRefsResolve(bundled);

const bundledYaml = YAML.stringify(bundled, { lineWidth: 0 });

// Everything this script writes is committed, so it all goes through Prettier — otherwise a build
// leaves the working tree failing the repo-wide `npm run format` check in CI.
const prettierConfig = await prettier.resolveConfig(publicJsonPath);
const bundledJson = await prettier.format(JSON.stringify(bundled), {
  ...prettierConfig,
  filepath: publicJsonPath,
});

/** Writes only when the content differs, so an unchanged spec leaves every file untouched. */
function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  fs.writeFileSync(file, text, "utf8");
  return true;
}

writeIfChanged(bundlePath, bundledYaml);
writeIfChanged(publicYamlPath, bundledYaml);
writeIfChanged(publicJsonPath, bundledJson);

const pathCount = Object.keys(bundled.paths ?? {}).length;
const schemaCount = Object.keys(bundled.components?.schemas ?? {}).length;
console.log(
  `[api-docs] bundled ${pathCount} paths and ${schemaCount} schemas -> openapi.yaml, public/openapi.{json,yaml}`,
);

/* ---------------------------------------------------------------- generate */

// Pages are built in a temporary folder and copied over only when they differ. A failed generation
// leaves the existing pages alone, and an unchanged spec touches no file. The hand-written
// `overview.mdx` files and the `meta.json` navigation are authored by us and are never written
// or deleted here.

// Run from the app root and reference the schema exactly as `lib/openapi.ts` does. Generated pages
// record this string in `_openapi.preload`, and the runtime looks documents up by that same key —
// an absolute path here would not match the `["./openapi.yaml"]` registered at render time.
process.chdir(appRoot);

const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-docs-"));

function stagedPages(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return stagedPages(path.join(dir, entry.name), relative);
    return entry.name.endsWith(".mdx") && entry.name !== "overview.mdx" ? [relative] : [];
  });
}

try {
  await generateFiles({
    input: createOpenAPI({ input: ["./openapi.yaml"], proxyUrl: "/api/proxy" }),
    output: stagingDir,
    per: "operation",
    groupBy: "tag",
  });

  const pages = stagedPages(stagingDir);
  const formatted = new Map();
  let updated = 0;
  let removed = 0;

  // `fumadocs-openapi` does not emit Prettier-formatted MDX, and these pages are committed. Without
  // formatting, any build leaves a tree that fails the repo-wide `npm run format` check in CI.
  await Promise.all(
    pages.map(async (relative) => {
      const destination = path.join(outputDir, relative);
      const source = fs.readFileSync(path.join(stagingDir, relative), "utf8");

      formatted.set(
        relative,
        await prettier.format(source, {
          ...(await prettier.resolveConfig(destination)),
          filepath: destination,
        }),
      );
    }),
  );

  // Swept before writing: on a case-insensitive disk a page renamed only in case is written through
  // the old file name, and a sweep after the write would delete it.
  const keep = new Set(pages);
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    for (const file of fs.readdirSync(path.join(outputDir, entry.name))) {
      const relative = path.join(entry.name, file);
      if (file.endsWith(".mdx") && file !== "overview.mdx" && !keep.has(relative)) {
        fs.rmSync(path.join(outputDir, relative));
        removed++;
      }
    }
  }

  for (const [relative, text] of formatted) {
    const destination = path.join(outputDir, relative);

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (writeIfChanged(destination, text)) updated++;
  }

  console.log(
    `[api-docs] ${pages.length} MDX pages in content/api-reference (${updated} written, ${removed} removed)`,
  );

  // Sidebar order lives in each folder's hand-written `meta.json`, so a new operation gets a page
  // that no menu links to until someone lists it there. Say so instead of shipping it silently.
  const unlisted = [];
  for (const folder of new Set(pages.map((relative) => path.dirname(relative)))) {
    if (folder === ".") continue;

    const metaPath = path.join(outputDir, folder, "meta.json");
    const listed = fs.existsSync(metaPath)
      ? new Set(JSON.parse(fs.readFileSync(metaPath, "utf8")).pages ?? [])
      : new Set();

    for (const relative of pages.filter((page) => path.dirname(page) === folder)) {
      const name = path.basename(relative, ".mdx");
      if (!listed.has(name)) unlisted.push(`${folder}/${name}`);
    }
  }

  if (unlisted.length > 0) {
    const list = unlisted.map((page) => `  ${page}`).join("\n");
    console.warn(
      `[api-docs] WARNING: ${unlisted.length} page(s) are missing from their folder's meta.json and will not appear in the sidebar:\n${list}`,
    );

    // Strict only in the CI drift check: a hosted docs build must not fail over navigation.
    if (process.env.API_DOCS_STRICT) process.exitCode = 1;
  }
} finally {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
