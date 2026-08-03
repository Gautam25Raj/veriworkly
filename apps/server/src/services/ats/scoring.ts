import { getAtsEnginePolicy } from "#services/ats/enginePolicy";
import type { AtsEngineRule, AtsEnginePolicy } from "#services/ats/enginePolicy";
import type { AtsCategoryScore, AtsReport, AtsRuleResult } from "#services/ats/types";

/**
 * `resume` accepts an arbitrary JSON object (a Studio resume document), and the body parser
 * allows 4 MB — so the shape reaching `flatten` is attacker-controlled and can be nested as
 * deeply as that budget allows. Unbounded recursion over it is a stack-overflow away from a
 * 500 on every request that shares the worker, so depth is capped. Real resume documents nest
 * about four levels (document -> section -> item -> highlights), so 24 is far past anything
 * legitimate and still shallow enough to be safe.
 */
const MAX_FLATTEN_DEPTH = 24;

function flatten(value: unknown, depth = 0): string {
  if (typeof value === "string") return value;
  if (depth >= MAX_FLATTEN_DEPTH) return "";
  if (Array.isArray(value)) return value.map((item) => flatten(item, depth + 1)).join("\n");
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key} ${flatten(item, depth + 1)}`)
      .join("\n");
  return "";
}

function words(text: string) {
  return text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];
}

/**
 * Same tokenizer as `words()` but allows 2-letter tokens. `words()` requires 3+ characters,
 * which is right for word-count/length scoring — but it silently drops exactly the tokens the
 * keyword synonym map targets ("js", "ml", "ai", "ux", "ui", "qa", "pm", "hr" are all 2 letters),
 * so vocabulary extraction needs its own, more permissive pass.
 */
function vocabularyWords(text: string) {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) ?? [];
  // The trailing "." in the character class exists to keep "node.js" together — but it also
  // glues a sentence-ending period onto whatever word precedes it ("JavaScript." at the end of
  // a line), which would silently fail to match the same word spelled cleanly elsewhere. Strip
  // only a *trailing* run of dots; internal ones (node.js) are untouched.
  return raw.map((token) => token.replace(/\.+$/, "")).filter(Boolean);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Conservative suffix stripper — good enough to fold "managed/manages/managing" together without a stemmer dependency. */
function stem(word: string): string {
  if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

type RuleContext = {
  text: string;
  wordCount: number;
  lines: string[];
  policy: AtsEnginePolicy;
};

function evaluateRule(rule: AtsEngineRule, ctx: RuleContext): AtsRuleResult {
  if (rule.kind === "min-words") {
    const passed = ctx.wordCount >= rule.min;
    const vars = { n: ctx.wordCount };
    return {
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      passed,
      evidence: formatTemplate(passed ? rule.passEvidence : rule.failEvidence, vars),
      scoreImpact: passed ? 0 : rule.weight,
      fix: rule.fix,
    };
  }

  if (rule.kind === "presence") {
    const re = new RegExp(rule.pattern, rule.flags);
    const matched = re.test(ctx.text);
    const passed = rule.invert ? !matched : matched;
    return {
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      passed,
      evidence: passed ? rule.passEvidence : rule.failEvidence,
      scoreImpact: passed ? 0 : rule.weight,
      fix: rule.fix,
    };
  }

  if (rule.kind === "position") {
    const emailMatch = ctx.text.match(new RegExp(rule.emailPattern, "i"));
    const phoneMatch = ctx.text.match(new RegExp(rule.phonePattern));
    const emailIndex = emailMatch?.index ?? Infinity;
    const phoneIndex = phoneMatch?.index ?? Infinity;
    const earliest = Math.min(emailIndex, phoneIndex);
    const hasContact = Number.isFinite(earliest);
    const threshold = ctx.text.length * rule.windowFraction;
    const passed = !hasContact || earliest <= threshold;
    return {
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      passed,
      evidence: passed ? rule.passEvidence : rule.failEvidence,
      scoreImpact: passed ? 0 : rule.weight,
      fix: rule.fix,
    };
  }

  // kind === "bands"
  const value = resolveBandMetric(rule, ctx);
  const band =
    rule.bands.find((candidate) => candidate.upTo !== null && value <= candidate.upTo) ??
    rule.bands[rule.bands.length - 1];
  const passed = band.weight === 0;
  const vars = { n: Math.round(value), pct: Math.round(value * 100) };
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    passed,
    evidence: formatTemplate(passed ? rule.passEvidence : rule.failEvidence, vars),
    scoreImpact: band.weight,
    fix: rule.fix,
  };
}

/**
 * The worst this rule could have cost. For everything except banded rules that is simply the
 * rule's weight; a banded rule's ceiling is its heaviest band. Used only to turn per-rule
 * impacts into a per-category percentage — the individual weights never leave the server.
 */
function maxImpactOf(rule: AtsEngineRule): number {
  if (rule.kind === "bands")
    return rule.bands.reduce((worst, band) => Math.max(worst, band.weight), 0);
  return rule.weight;
}

function rollUpCategories(
  policyRules: AtsEngineRule[],
  results: AtsRuleResult[],
): AtsCategoryScore[] {
  const totals = new Map<string, AtsCategoryScore>();

  results.forEach((result, index) => {
    const possible = maxImpactOf(policyRules[index]);
    const entry = totals.get(result.category) ?? {
      category: result.category,
      score: 100,
      passed: 0,
      total: 0,
      lost: 0,
      possible: 0,
    };
    entry.total += 1;
    entry.passed += result.passed ? 1 : 0;
    entry.lost += result.scoreImpact;
    entry.possible += possible;
    totals.set(result.category, entry);
  });

  return [...totals.values()].map((entry) => ({
    ...entry,
    lost: Math.round(entry.lost),
    possible: Math.round(entry.possible),
    // A category whose rules carry no weight at all is informational, not failed — report it
    // as complete rather than dividing by zero.
    score:
      entry.possible > 0
        ? Math.max(0, Math.round((1 - entry.lost / entry.possible) * 100))
        : entry.passed === entry.total
          ? 100
          : 0,
  }));
}

function resolveBandMetric(
  rule: Extract<AtsEngineRule, { kind: "bands" }>,
  ctx: RuleContext,
): number {
  if (rule.metric === "wordCount") return ctx.wordCount;

  if (rule.metric === "metricsRatio") {
    if (!rule.pattern || ctx.lines.length === 0) return 0;
    const re = new RegExp(rule.pattern, rule.flags || "i");
    const withMetric = ctx.lines.filter((line) => re.test(line)).length;
    return withMetric / ctx.lines.length;
  }

  // buzzwordCount
  const lower = ctx.text.toLowerCase();
  return ctx.policy.keywordMatch.buzzwords.reduce(
    (count, phrase) => count + (lower.includes(phrase) ? 1 : 0),
    0,
  );
}

function sectionWindowText(text: string, pattern: string, flags: string) {
  const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    chunks.push(match[0].toLowerCase());
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return chunks.join(" ");
}

/** Maps resume/job text to a canonical term -> display-label lookup: multi-word skills collapse to one token, synonyms and abbreviations fold to a shared canonical form, and single words are lightly stemmed so inflections line up. */
function extractVocabulary(text: string, km: AtsEnginePolicy["keywordMatch"]) {
  const lower = text.toLowerCase();
  const stopwords = new Set(km.stopwords);
  const consumed = new Set<string>();
  const map = new Map<string, string>();

  for (const phrase of km.phrases) {
    if (new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(lower)) {
      map.set(phrase, phrase);
      for (const part of phrase.split(" ")) consumed.add(part);
    }
  }

  for (const raw of vocabularyWords(lower)) {
    if (stopwords.has(raw) || consumed.has(raw)) continue;
    const mapped = km.synonyms[raw] ?? raw;
    if (mapped.includes(" ")) {
      if (!map.has(mapped)) map.set(mapped, mapped);
      continue;
    }
    const token = stem(mapped);
    if (!map.has(token)) map.set(token, raw);
  }

  return map;
}

function computeJobMatch(
  resumeText: string,
  jobDescription: string | undefined,
  policy: AtsEnginePolicy,
) {
  const km = policy.keywordMatch;
  const jobText = jobDescription?.trim();
  if (!jobText)
    return { score: null as number | null, matched: [] as string[], missing: [] as string[] };

  const jobLower = jobText.toLowerCase();
  const jobTerms = extractVocabulary(jobText, km);
  if (jobTerms.size === 0) return { score: null, matched: [], missing: [] };

  const resumeTerms = extractVocabulary(resumeText, km);
  // Canonicalize the section windows through the same vocabulary pass as the resume/job text —
  // comparing raw substrings here would miss a synonym like "JS" against the canonical token
  // "javascript" that the term loop below actually looks up.
  const requiredWindow = sectionWindowText(
    jobLower,
    km.requiredSectionPattern,
    km.requiredSectionFlags,
  );
  const preferredWindow = sectionWindowText(
    jobLower,
    km.preferredSectionPattern,
    km.preferredSectionFlags,
  );
  const requiredTerms = new Set(extractVocabulary(requiredWindow, km).keys());
  const preferredTerms = new Set(extractVocabulary(preferredWindow, km).keys());

  function weightFor(term: string) {
    if (requiredTerms.has(term)) return km.requiredWeight;
    if (preferredTerms.has(term)) return km.preferredWeight;
    return km.defaultWeight;
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const matched: Array<{ label: string; weight: number }> = [];
  const missing: Array<{ label: string; weight: number }> = [];

  for (const [token, label] of jobTerms) {
    const weight = weightFor(token);
    totalWeight += weight;
    if (resumeTerms.has(token)) {
      matchedWeight += weight;
      matched.push({ label, weight });
    } else {
      missing.push({ label, weight });
    }
  }

  matched.sort((a, b) => b.weight - a.weight);
  missing.sort((a, b) => b.weight - a.weight);

  return {
    score: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : null,
    matched: matched.slice(0, 12).map((m) => m.label),
    missing: missing.slice(0, 12).map((m) => m.label),
  };
}

export class AtsScoringService {
  static extractText(resume: unknown) {
    return flatten(resume).replace(/\s+/g, " ").trim().slice(0, 50_000);
  }

  static check(resume: unknown, jobDescription?: string): AtsReport {
    const policy = getAtsEnginePolicy();
    const rawText = flatten(resume).trim().slice(0, 50_000);
    const text = rawText.replace(/\s+/g, " ").trim();
    const lines = rawText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const wordCount = words(text).length;
    const ctx: RuleContext = { text, wordCount, lines, policy };

    const rules = policy.rules.map((rule) => evaluateRule(rule, ctx));
    const readinessScore = Math.max(
      0,
      100 - rules.reduce((sum, rule) => sum + rule.scoreImpact, 0),
    );

    const jobMatch = computeJobMatch(text, jobDescription, policy);
    const failedChecks = rules.filter((rule) => !rule.passed);
    const strengths = rules
      .filter((rule) => rule.passed)
      .slice(0, 5)
      .map((rule) => rule.evidence);

    return {
      version: policy.version as AtsReport["version"],
      readinessScore,
      jobMatchScore: jobMatch.score,
      matchedKeywords: jobMatch.matched,
      missingKeywords: jobMatch.missing,
      // Match on the declared category rather than a substring of the rule id: the id is a
      // naming convention, the category is the field that actually means "this is a parsing
      // check", and a rule renamed without "parse" in its id would silently stop reporting.
      parsingWarnings: rules
        .filter((rule) => !rule.passed && (rule.category === "parse" || rule.category === "format"))
        .map((rule) => rule.evidence),
      strengths,
      failedChecks,
      prioritizedFixes: [...failedChecks]
        .sort((a, b) => b.scoreImpact - a.scoreImpact)
        .slice(0, 6)
        .map((rule) => rule.fix),
      rules,
      categories: rollUpCategories(policy.rules, rules),
      checksPassed: rules.length - failedChecks.length,
      checksTotal: rules.length,
      wordCount,
    };
  }
}
