import { z } from "zod";

import { config, isProduction } from "#config";
import { getAiActionsPolicyJson, resolvePrivateAiModel } from "#services/aiPrivateConfig";
import { AI_ACTION_KEYS, type AiActionKey, type AiMode } from "#services/aiTypes";
import { ApiError } from "#lib/errors";
import { logger } from "#lib/logger";

const modePolicySchema = z.object({
  credits: z.number().int().positive(),
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive().max(32_768),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
});

const actionPolicySchema = z.object({
  maxTextChars: z.number().int().positive().max(50_000),
  maxContextChars: z.number().int().nonnegative().max(50_000),
  maxJobDescriptionChars: z.number().int().nonnegative().max(20_000),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  standard: modePolicySchema,
  expert: modePolicySchema,
});

const policySchema = z.partialRecord(z.enum(AI_ACTION_KEYS), actionPolicySchema);

let cachedPolicy: z.infer<typeof policySchema> | null = null;

/**
 * What the client is told when the policy cannot be used (V-184). The cause (zod issues, a JSON
 * parse error, a missing action) is an operator's concern and goes to the log only: the message
 * reaches a toast.
 */
const POLICY_UNAVAILABLE = "AI generation is unavailable right now. Please try again later.";

function loadPolicy() {
  if (cachedPolicy) return cachedPolicy;

  try {
    const parsed = policySchema.parse(getAiActionsPolicyJson());
    const missing = AI_ACTION_KEYS.find((action) => !parsed[action]);
    if (missing) throw new Error(`AI policy is missing action: ${missing}.`);
    cachedPolicy = parsed;
    return cachedPolicy;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("AI actions policy failed validation", {
        issues: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 10),
      });
    } else {
      logger.error("AI actions policy could not be loaded", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw new ApiError(503, POLICY_UNAVAILABLE);
  }
}

export function getAiActionPolicy(action: AiActionKey) {
  const policy = loadPolicy()[action];
  if (!policy) throw new ApiError(400, "Unsupported AI action.");
  return policy;
}

export function getAiModePolicy(action: AiActionKey, mode: AiMode) {
  const policy = getAiActionPolicy(action)[mode];
  return { ...policy, model: resolvePrivateAiModel(policy.model) };
}

export function publicAiActionPolicy() {
  const policy = loadPolicy();

  return Object.fromEntries(
    AI_ACTION_KEYS.map((action) => {
      const item = policy[action];
      // Unreachable after `loadPolicy` checked every action; generic for the same reason.
      if (!item) throw new ApiError(503, POLICY_UNAVAILABLE);
      return [
        action,
        {
          costs: { standard: item.standard.credits, expert: item.expert.credits },
        },
      ];
    }),
  );
}

export function validateAiRuntimeConfig() {
  if (!isProduction) return;
  if (!config.ai.apiKey)
    throw new Error("AI provider credentials must be configured in production.");
  loadPolicy();
  for (const action of AI_ACTION_KEYS) {
    getAiModePolicy(action, "standard");
    getAiModePolicy(action, "expert");
  }
}
