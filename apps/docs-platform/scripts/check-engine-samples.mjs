/**
 * Type-checks every TypeScript sample in the ATS Engine docs against the installed
 * `@veriworkly/ats-engine`, so a page cannot show an import, an option or a field the engine does
 * not have. The engine's own repository does the same for its README (`npm run smoke`).
 *
 * Checked: fenced blocks whose language is `ts` or `typescript`, under `content/ats-engine`. Each
 * block is its own ES module, compiled with `strict` and `exactOptionalPropertyTypes`, with
 * top-level await. Two inputs are declared for every sample, so pages need not read a file
 * first: `resumeText` and `postingText`, both strings. Put `nocheck` in a fence's meta
 * (```ts nocheck) for a fragment that is not meant to compile on its own.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(appRoot, "content/ats-engine");
// Inside the app, so `@veriworkly/ats-engine` and `next` resolve from its node_modules.
const workDir = path.join(appRoot, ".engine-samples");

const PRELUDE = "declare const resumeText: string;\ndeclare const postingText: string;\n";

function listPages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(entryPath);
    return /\.mdx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function extractSamples(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const samples = [];
  let open = null;

  lines.forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})(\S*)\s*(.*)$/);

    if (!open) {
      if (fence && /^(ts|typescript)$/.test(fence[2]) && !/\bnocheck\b/.test(fence[3])) {
        open = { marker: fence[1], start: index + 2, body: [] };
      } else if (fence) {
        open = { marker: fence[1], skip: true };
      }
      return;
    }

    if (fence && fence[1].startsWith(open.marker) && fence[2] === "") {
      if (!open.skip) samples.push({ filePath, start: open.start, code: open.body.join("\n") });
      open = null;
      return;
    }

    if (!open.skip) open.body.push(line.replace(/\s*\/\/ \[!code[^\]]*\]$/, ""));
  });

  return samples;
}

const samples = listPages(contentDir).flatMap(extractSamples);

fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const fileToSample = new Map();
const preludeLines = PRELUDE.split("\n").length - 1;

samples.forEach((sample, index) => {
  const samplePath = path.join(workDir, `sample-${index}.mts`);
  fs.writeFileSync(samplePath, `${PRELUDE}${sample.code}\nexport {};\n`);
  fileToSample.set(path.normalize(samplePath), sample);
});

const program = ts.createProgram([...fileToSample.keys()], {
  noEmit: true,
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: false,
  // How a bundled app (Next.js, a Worker) resolves the package and `next/server`.
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2023,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  types: ["node"],
  skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);
let failures = 0;

for (const diagnostic of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const sample = diagnostic.file && fileToSample.get(path.normalize(diagnostic.file.fileName));

  if (!sample || diagnostic.start === undefined) {
    console.error(`error: ${message}`);
    failures++;
    continue;
  }

  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const pageLine = sample.start + line - preludeLines;
  const where = `${path.relative(appRoot, sample.filePath)}:${pageLine}`;

  console.error(`${where}: ${message}`);
  failures++;
}

fs.rmSync(workDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} error(s) in ${samples.length} ATS Engine docs samples.`);
  process.exit(1);
}

console.log(`All ${samples.length} ATS Engine docs samples type-check.`);
