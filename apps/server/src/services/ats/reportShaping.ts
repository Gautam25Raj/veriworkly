import type { AtsCategoryScore, AtsReport } from "#services/ats/types";

export type AtsVerdict = "strong" | "needs-work" | "weak";

export type AtsRestrictedReport = {
  version: AtsReport["version"];
  restricted: true;
  readinessScore: number;
  jobMatchScore: number | null;
  verdict: AtsVerdict;
  topFix: string | null;
  /** Aggregate only — which areas lost points, never which rule or by how much per rule. */
  categories: AtsCategoryScore[];
  checksPassed: number;
  checksTotal: number;
  matchedKeywordCount: number;
  missingKeywordCount: number;
};

export type AtsFullReport = AtsReport & { restricted: false; verdict: AtsVerdict };

export type AtsShapedReport = AtsFullReport | AtsRestrictedReport;

/** Job match matters more than raw formatting once a target role is on the table. */
export function computeVerdict(report: AtsReport): AtsVerdict {
  const primary = report.jobMatchScore ?? report.readinessScore;
  if (primary >= 75) return "strong";
  if (primary >= 45) return "needs-work";
  return "weak";
}

/**
 * Anonymous callers get the score, a verdict, and a per-category rollup — not the answer key.
 * Rule-by-rule evidence, the literal keyword lists, and the full fix list require a VeriWorkly
 * account. This is enforced here, server-side, not by hiding fields in the UI: the restricted
 * shape simply never contains them.
 *
 * The rollup is included deliberately. A bare number tells a visitor nothing actionable, which
 * made the free tier feel like a paywall with a teaser rather than a tool; category percentages
 * and pass counts are aggregates of impacts the full report already exposes, so they say *where*
 * the resume is losing points without revealing which rule fired or what it weighs.
 */
export function shapeReport(report: AtsReport, authenticated: boolean): AtsShapedReport {
  if (authenticated) return { ...report, restricted: false, verdict: computeVerdict(report) };

  return {
    version: report.version,
    restricted: true,
    readinessScore: report.readinessScore,
    jobMatchScore: report.jobMatchScore,
    verdict: computeVerdict(report),
    topFix: report.prioritizedFixes[0] ?? null,
    categories: report.categories,
    checksPassed: report.checksPassed,
    checksTotal: report.checksTotal,
    matchedKeywordCount: report.matchedKeywords.length,
    missingKeywordCount: report.missingKeywords.length,
  };
}
