export type AtsRuleResult = {
  id: string;
  category: string;
  severity: "info" | "warning" | "error";
  passed: boolean;
  evidence: string;
  scoreImpact: number;
  fix: string;
};

export type AtsVerdict = "strong" | "needs-work" | "weak";

/** Per-area rollup of the deterministic rules, so the panel can show where the score went. */
export type AtsCategoryScore = {
  category: string;
  score: number;
  passed: number;
  total: number;
  lost: number;
  possible: number;
};

/**
 * Studio only ever calls /ats/check and /ats/analyze while logged in, so it always receives
 * the full (unrestricted) report — the anonymous, score-only shape is a site-checker concern.
 */
export type AtsReport = {
  version: "ats-v2";
  restricted: false;
  verdict: AtsVerdict;
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

export type AtsResult = {
  report: AtsReport;
  ai: {
    explanation: string;
    missingEvidence: string[];
    keywordOpportunities: string[];
    recommendedImprovements: string[];
    priorityOrder: string[];
  } | null;
  creditsSpent: number;
  quota: {
    tier: "anonymous" | "free" | "subscriber";
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
    canConvertResume: boolean;
    pricing: AtsPricing;
    extract: { limit: number; used: number; remaining: number };
  };
};

export type AtsPricing = {
  analysisCredits: { min: number; max: number };
  jobUrlAnalysisCredits: { min: number; max: number };
  resumeConversionCredits: number;
};

export type AtsQuota = AtsResult["quota"];

export type ConvertedResume = {
  basics: {
    fullName: string;
    role: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
  };
  links: Array<{ label: string; url: string }>;
  summary: string;
  experience: Array<{
    company: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    summary: string;
    highlights: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    current: boolean;
    summary: string;
  }>;
  projects: Array<{
    name: string;
    role: string;
    link: string;
    summary: string;
    highlights: string[];
    skills: string[];
  }>;
  skills: Array<{ name: string; keywords: string[] }>;
};
