import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { isActivePath } from "../src/components/layout/navbar/isActivePath";

const SRC = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

const rules: { name: string; pattern: RegExp; why: string; allow?: string[] }[] = [
  {
    name: "tw-animate-css classes",
    pattern: /\b(animate-in|fade-in|zoom-in-\d+|slide-in-from-[a-z]+)\b/,
    why: "No app installs tw-animate-css, so these generate nothing. Use `starting:`.",
  },
  {
    name: "dead tokens",
    pattern: /\b(border-border-hover|text-muted-foreground|placeholder:text-muted-foreground)\b/,
    why: "--border-hover does not exist; muted-foreground is unmapped in site and docs.",
  },
  {
    name: "focus-visible:outline-none",
    pattern: /focus-visible:outline-none/,
    why: "Forced-colors mode strips ring box-shadows. Use outline-hidden.",
  },
  {
    name: "raw palette colours",
    pattern: /\b(?:bg|text|border|ring|fill)-(?:zinc|slate|gray|emerald|blue)-\d{2,3}\b/,
    why: "Raw palette colours ignore the theme. Use the tokens in themes.css.",
  },
  {
    name: "transition-all",
    pattern: /\btransition-all\b/,
    why: "Name the properties; `all` also animates layout ones by accident.",
  },
  {
    name: "arbitrary z-index",
    pattern: /z-\[\d+\]|zIndex:\s*\d{3,}/,
    why: "Use the scale: menu 30, navbar 100, modal 200, skip link 300.",
  },
];

describe("source guardrails", () => {
  for (const rule of rules) {
    it(`has no ${rule.name}`, () => {
      const offenders = files
        .filter((file) => !rule.allow?.includes(file.path))
        .filter((file) => rule.pattern.test(file.text))
        .map((file) => `${file.path}: ${file.text.match(rule.pattern)?.[0]}`);

      expect(offenders, rule.why).toEqual([]);
    });
  }

  it("never ships a target=_blank link without rel", () => {
    const offenders = files.filter((file) =>
      [...file.text.matchAll(/<Link[\s\S]*?>/g)].some(
        (match) => /target=/.test(match[0]) && !/rel=/.test(match[0]),
      ),
    );

    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it("declares color-scheme for both themes", () => {
    const themes = files.find((file) => file.path === "styles/themes.css")!.text;

    expect(themes).toMatch(/:root \{\s*color-scheme: light;/);
    expect(themes).toMatch(/\.dark \{\s*color-scheme: dark;/);
  });
});

describe("isActivePath", () => {
  it.each([
    ["/templates", "/templates", true],
    ["/templates/signal", "/templates", true],
    ["/templates-old", "/templates", false],
    ["/blog", "/", false],
    ["/", "/", true],
    ["/templates", "https://veriworkly.com/templates", false],
    [null, "/templates", false],
  ])("pathname %s, href %s -> %s", (pathname, href, expected) => {
    expect(isActivePath(pathname, href)).toBe(expected);
  });
});
