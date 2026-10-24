import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seedDir = join(__dirname, "..", "..", "scripts", "seed-data");

type Entry = {
  id: string;
  version: string;
  title: string;
  type: string;
  publishedAt: string;
  githubUrl?: string | null;
  added?: string[];
  improved?: string[];
  fixed?: string[];
};

const entries: Entry[] = JSON.parse(readFileSync(join(seedDir, "changelog-entries.json"), "utf8"));

const tagUrl = (version: string) =>
  new RegExp(
    `^https://github\\.com/VeriWorkly/veriworkly/releases/tag/(Release-)?v${version.replaceAll(".", "\\.")}$`,
  );

describe("changelog seed data", () => {
  it("gives every entry a real publish date", () => {
    const invalid = entries.filter(
      (entry) =>
        !/^\d{4}-\d{2}-\d{2}T/.test(entry.publishedAt) || isNaN(+new Date(entry.publishedAt)),
    );

    expect(invalid.map((entry) => `${entry.version}: "${entry.publishedAt}"`)).toEqual([]);
  });

  it("has unique ids and versions, and an id that matches the version", () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.version)).size).toBe(entries.length);

    for (const entry of entries) {
      expect(entry.id).toBe(`v${entry.version.replaceAll(".", "-")}`);
    }
  });

  it("fills the fields the seed script reads", () => {
    for (const entry of entries) {
      expect(entry.title?.trim(), entry.version).toBeTruthy();
      expect(["major", "minor", "patch"], entry.version).toContain(entry.type);
      expect(
        [...(entry.added ?? []), ...(entry.improved ?? []), ...(entry.fixed ?? [])].length,
        entry.version,
      ).toBeGreaterThan(0);
    }
  });

  it("points each release at a tag for its own version", () => {
    for (const entry of entries) {
      expect(entry.githubUrl, entry.version).toMatch(tagUrl(entry.version));
    }
  });

  it("keeps the newest release first", () => {
    const times = entries.map((entry) => +new Date(entry.publishedAt));

    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
