export type AtsSeverity = "info" | "warning" | "error";

export type AtsRuleResult = {
  id: string;
  category: string;
  severity: AtsSeverity;
  passed: boolean;
  evidence: string;
  scoreImpact: number;
  fix: string;
};

/**
 * Per-category rollup of the deterministic rules. `lost` is the sum of the score impacts the
 * category actually cost, `possible` the worst case it could have cost, so `score` is the
 * percentage of that category the resume kept. Exposing the rollup is deliberately safe: it is
 * an aggregate of numbers the full report already returns per rule, and it tells an anonymous
 * caller *where* the problem is without handing over the rule-by-rule answer key.
 */
export type AtsCategoryScore = {
  category: string;
  score: number;
  passed: number;
  total: number;
  lost: number;
  possible: number;
};

export type AtsReport = {
  version: "ats-v2";
  readinessScore: number;
  jobMatchScore: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  parsingWarnings: string[];
  strengths: string[];
  failedChecks: AtsRuleResult[];
  prioritizedFixes: string[];
  rules: AtsRuleResult[];
  categories: AtsCategoryScore[];
  checksPassed: number;
  checksTotal: number;
  wordCount: number;
};

export type AtsAiInsights = {
  explanation: string;
  missingEvidence: string[];
  keywordOpportunities: string[];
  recommendedImprovements: string[];
  priorityOrder: string[];
};

export type AtsQuotaSummary = {
  tier: "anonymous" | "free" | "subscriber";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  canConvertResume: boolean;
  pricing: {
    analysisCredits: { min: number; max: number };
    jobUrlAnalysisCredits: { min: number; max: number };
    resumeConversionCredits: number;
  };
  extract: {
    limit: number;
    used: number;
    remaining: number;
  };
};
