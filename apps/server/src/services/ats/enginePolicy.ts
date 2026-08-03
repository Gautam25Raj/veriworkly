import { z } from "zod";

import { getAtsEnginePolicyJson } from "#services/aiPrivateConfig";
import { ApiError } from "#lib/errors";

const bandSchema = z.object({
  upTo: z.number().nullable(),
  weight: z.number().nonnegative(),
});

const ruleBase = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  passEvidence: z.string().min(1),
  failEvidence: z.string().min(1),
  fix: z.string().min(1),
});

const minWordsRule = z.object({
  ...ruleBase.shape,
  kind: z.literal("min-words"),
  min: z.number().int().positive(),
  weight: z.number().nonnegative(),
});

const presenceRule = z.object({
  ...ruleBase.shape,
  kind: z.literal("presence"),
  pattern: z.string().min(1),
  flags: z.string().default(""),
  invert: z.boolean().default(false),
  weight: z.number().nonnegative(),
});

const positionRule = z.object({
  ...ruleBase.shape,
  kind: z.literal("position"),
  emailPattern: z.string().min(1),
  phonePattern: z.string().min(1),
  windowFraction: z.number().min(0).max(1),
  weight: z.number().nonnegative(),
});

const bandsRule = z.object({
  ...ruleBase.shape,
  kind: z.literal("bands"),
  metric: z.enum(["wordCount", "metricsRatio", "buzzwordCount"]),
  pattern: z.string().min(1).optional(),
  flags: z.string().default(""),
  bands: z.array(bandSchema).min(1),
});

const ruleSchema = z.discriminatedUnion("kind", [
  minWordsRule,
  presenceRule,
  positionRule,
  bandsRule,
]);

const keywordMatchSchema = z.object({
  requiredWeight: z.number().positive(),
  preferredWeight: z.number().positive(),
  defaultWeight: z.number().positive(),
  requiredSectionPattern: z.string().min(1),
  requiredSectionFlags: z.string().default("gi"),
  preferredSectionPattern: z.string().min(1),
  preferredSectionFlags: z.string().default("gi"),
  stopwords: z.array(z.string()),
  synonyms: z.record(z.string()),
  phrases: z.array(z.string()),
  buzzwords: z.array(z.string()),
});

const atsEngineSchema = z.object({
  version: z.string().min(1),
  rules: z.array(ruleSchema).min(1),
  keywordMatch: keywordMatchSchema,
});

export type AtsEngineRule = z.infer<typeof ruleSchema>;
export type AtsEnginePolicy = z.infer<typeof atsEngineSchema>;

let cached: AtsEnginePolicy | null = null;

export function getAtsEnginePolicy(): AtsEnginePolicy {
  if (cached) return cached;

  try {
    cached = atsEngineSchema.parse(getAtsEnginePolicyJson());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "AI ATS engine policy is invalid.");
  }
  return cached;
}
