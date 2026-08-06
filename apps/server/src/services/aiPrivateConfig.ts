import { readFileSync } from "node:fs";

import { config } from "#config";
import { ApiError } from "#lib/errors";

const cache = new Map<string, unknown>();

/**
 * Generic loader for a private (gitignored) JSON policy file, delivered the same way in every
 * environment: either inlined as an env var (`jsonValue`) or mounted/pointed to on disk
 * (`pathValue`). Each policy — AI writing actions, ATS AI prompts, ATS scoring engine — lives in
 * its own file and its own env var pair, so `label` should name that specific policy in error
 * messages rather than a generic "AI config".
 */
function loadPrivateJson(cacheKey: string, pathValue: string, jsonValue: string, label: string) {
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const source = jsonValue ? jsonValue : pathValue ? readFileSync(pathValue, "utf8") : "";
  if (!source) throw new ApiError(503, `${label} is not configured.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new ApiError(503, `${label} is invalid JSON.`);
  }

  cache.set(cacheKey, parsed);
  return parsed;
}

export function getAiActionsPolicyJson() {
  return loadPrivateJson(
    "ai-actions",
    config.ai.actionsPolicyPath,
    config.ai.actionsPolicyJson,
    "AI actions policy",
  );
}

export function getAtsAiPolicyJson() {
  return loadPrivateJson(
    "ats-ai",
    config.ai.atsAiPolicyPath,
    config.ai.atsAiPolicyJson,
    "ATS AI policy",
  );
}

export function getAtsEnginePolicyJson() {
  return loadPrivateJson(
    "ats-engine",
    config.ai.atsEnginePolicyPath,
    config.ai.atsEnginePolicyJson,
    "ATS engine policy",
  );
}

export function resolvePrivateAiModel(model: string) {
  const match = model.match(/^env:([A-Z0-9_]+)$/);
  if (!match) return model;

  const resolved = process.env[match[1]];
  if (!resolved) throw new ApiError(503, "AI model routing is not configured.");

  return resolved;
}

export function resetPrivateAiConfigForTests() {
  cache.clear();
}
