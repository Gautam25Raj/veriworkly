import { describe, expect, it } from "vitest";

import { computeVerdict, shapeReport } from "../../src/services/ats/reportShaping";
import type { AtsReport } from "../../src/services/ats/types";

function report(overrides: Partial<AtsReport> = {}): AtsReport {
  return {
    version: "ats-v2",
    readinessScore: 60,
    jobMatchScore: null,
    matchedKeywords: ["react"],
    missingKeywords: ["kubernetes"],
    parsingWarnings: [],
    strengths: ["Email detected"],
    failedChecks: [],
    prioritizedFixes: ["Add measurable outcomes to more bullets."],
    rules: [
      {
        id: "ats-v2.contact.email",
        category: "contact",
        severity: "error",
        passed: true,
        evidence: "Email detected",
        scoreImpact: 0,
        fix: "Add a professional email address.",
      },
    ],
    categories: [{ category: "contact", score: 100, passed: 1, total: 1, lost: 0, possible: 10 }],
    checksPassed: 1,
    checksTotal: 1,
    wordCount: 420,
    ...overrides,
  };
}

describe("ATS verdict thresholds", () => {
  it("prefers job match over readiness when a target role is present", () => {
    expect(computeVerdict(report({ readinessScore: 20, jobMatchScore: 80 }))).toBe("strong");
    expect(computeVerdict(report({ readinessScore: 90, jobMatchScore: 20 }))).toBe("weak");
  });

  it("falls back to readiness when there is no job description", () => {
    expect(computeVerdict(report({ readinessScore: 85, jobMatchScore: null }))).toBe("strong");
    expect(computeVerdict(report({ readinessScore: 50, jobMatchScore: null }))).toBe("needs-work");
    expect(computeVerdict(report({ readinessScore: 10, jobMatchScore: null }))).toBe("weak");
  });
});

describe("ATS report shaping — the anonymous/authenticated split", () => {
  it("gives anonymous callers the score, verdict, category rollup, and one teaser fix", () => {
    const shaped = shapeReport(report(), false);

    expect(shaped.restricted).toBe(true);
    expect(shaped).toEqual({
      version: "ats-v2",
      restricted: true,
      readinessScore: 60,
      jobMatchScore: null,
      verdict: "needs-work",
      topFix: "Add measurable outcomes to more bullets.",
      categories: [{ category: "contact", score: 100, passed: 1, total: 1, lost: 0, possible: 10 }],
      checksPassed: 1,
      checksTotal: 1,
      matchedKeywordCount: 1,
      missingKeywordCount: 1,
    });
    // The full rule-by-rule breakdown and keyword lists must not leak into the restricted shape.
    expect(Object.keys(shaped)).not.toContain("rules");
    expect(Object.keys(shaped)).not.toContain("matchedKeywords");
    expect(Object.keys(shaped)).not.toContain("missingKeywords");
    expect(Object.keys(shaped)).not.toContain("failedChecks");
    expect(Object.keys(shaped)).not.toContain("prioritizedFixes");
    expect(Object.keys(shaped)).not.toContain("strengths");
  });

  it("counts keywords for anonymous callers without naming any of them", () => {
    const shaped = shapeReport(
      report({
        matchedKeywords: ["react", "typescript", "graphql"],
        missingKeywords: ["kubernetes", "terraform"],
      }),
      false,
    );

    if (!shaped.restricted) throw new Error("expected a restricted report");
    expect(shaped.matchedKeywordCount).toBe(3);
    expect(shaped.missingKeywordCount).toBe(2);
    expect(JSON.stringify(shaped)).not.toContain("kubernetes");
  });

  it("gives authenticated callers the full report untouched, flagged as unrestricted", () => {
    const source = report({ readinessScore: 80, jobMatchScore: null });
    const shaped = shapeReport(source, true);

    expect(shaped.restricted).toBe(false);
    expect(shaped).toMatchObject(source);
    expect((shaped as typeof source & { restricted: boolean; verdict: string }).verdict).toBe(
      "strong",
    );
    expect((shaped as typeof source & { restricted: boolean }).rules).toEqual(source.rules);
  });

  it("never returns a fix when there are no prioritized fixes to tease", () => {
    const shaped = shapeReport(report({ prioritizedFixes: [] }), false);
    expect(shaped.restricted).toBe(true);
    if (shaped.restricted) expect(shaped.topFix).toBeNull();
  });
});
