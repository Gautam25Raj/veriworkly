import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Framer is loaded per page through <MotionIsland> (LazyMotion + MotionConfig), not from the
 * root layout. Two ways that breaks silently: a component imports the full `motion` (which
 * re-bundles every feature), or a page renders `m.*` components without an island (they then
 * never animate, and anything starting at opacity 0 stays invisible).
 */

const root = join(__dirname, "..", "..");

function files(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full, ext);
    return name.endsWith(ext) ? [full] : [];
  });
}

const sources = ["features", "components", "providers", "app"].flatMap((dir) =>
  files(join(root, dir), ".tsx"),
);

/** Resolves an "@/..." or relative import to a file in this app, or null for packages. */
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(root, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

const usesM = (source: string) => /import \{[^}]*\bm\b[^}]*\} from "framer-motion"/.test(source);

/** True when the file, or anything it imports (statically or via dynamic()), renders `m.*`. */
function rendersMotion(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file)) return false;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  if (usesM(source)) return true;
  const specs = [...source.matchAll(/(?:from |import\()"([^"]+)"/g)].map((match) => match[1]!);
  return specs.some((spec) => {
    const target = resolveImport(file, spec);
    return target !== null && rendersMotion(target, seen);
  });
}

describe("framer stays inside motion islands", () => {
  it("no component imports the full motion component", () => {
    const offenders = sources.filter((file) =>
      /import \{[^}]*\bmotion\b[^}]*\} from "framer-motion"/.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  it("every page that renders m.* components, at any import depth, wraps them in <MotionIsland>", () => {
    const pages = files(join(root, "app"), "page.tsx");
    const missing = pages.filter(
      (file) => rendersMotion(file) && !/<MotionIsland/.test(readFileSync(file, "utf8")),
    );

    expect(missing.map((file) => relative(root, file))).toEqual([]);
  });

  it("the import walk finds m.* users (guards the check above against resolving nothing)", () => {
    expect(rendersMotion(join(root, "app", "(marketing)", "page.tsx"))).toBe(true);
  });
});
