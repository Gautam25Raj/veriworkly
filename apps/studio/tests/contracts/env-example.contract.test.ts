import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  documentedEnvNames,
  envReads,
  findUndocumentedEnvReads,
} from "../../scripts/check-env-example.mjs";

const studioDir = join(__dirname, "..", "..");

describe(".env.example documents every variable the studio reads", () => {
  it("finds the reads it checks", () => {
    // Guards the assertion below from passing on a scan that matched nothing.
    const reads = envReads(studioDir);

    expect(reads.has("NEXT_PUBLIC_BACKEND_URL")).toBe(true);
    expect(reads.has("INTERNAL_API_KEY")).toBe(true);
  });

  it("counts commented-out entries as documented", () => {
    expect(documentedEnvNames("A=1\n# B=\n#C=x\nnot D=1\n")).toEqual(new Set(["A", "B", "C"]));
  });

  it("has no process.env read missing from .env.example", () => {
    expect(findUndocumentedEnvReads(studioDir)).toEqual([]);
  });
});
