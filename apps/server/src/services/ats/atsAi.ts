import type { AtsEnginePolicy } from "@veriworkly/ats-engine";
import {
  AtsAiError,
  createAtsAi,
  type AtsAi,
  type AtsAiResult,
  type TaskRoute,
} from "@veriworkly/ats-engine/ai";
import { openAiCompatible } from "@veriworkly/ats-engine/ai/openai-compatible";

import { config } from "#config";
import { aiTimeoutError } from "#services/ats/aiDeadline";
import { CreditService } from "#services/creditService";
import { ApiError } from "#lib/errors";
import { logger } from "#lib/logger";

/**
 * The server's ATS AI, built on the same `@veriworkly/ats-engine/ai` API the package publishes.
 *
 * What stays here is what the package deliberately does not know: which model each plan is
 * routed to and at what price (`ai.ts`), the private prompts and engine policy, credentials,
 * credits, and logging. Each request gets its own instance so retries are logged against its
 * request id; building one is a few object allocations.
 */

type PolicyRoute = {
  model: string;
  maxOutputTokens: number;
  temperature: number;
  retries?: number;
  structuredOutputs: boolean;
  providerOptions?: Record<string, unknown>;
};

/** A policy route in the package's terms. */
export function taskRoute(route: PolicyRoute, system?: string): TaskRoute {
  return {
    model: route.model,
    maxTokens: route.maxOutputTokens,
    temperature: route.temperature,
    retries: route.retries ?? 0,
    structuredOutputs: route.structuredOutputs,
    providerOptions: route.providerOptions,
    system,
  };
}

/**
 * `enginePolicy` is needed only by parse repair, to classify repaired credentials; the other
 * tasks never touch it, so they do not load — or fail on — the private engine policy.
 */
export function createServerAtsAi(requestId: string, enginePolicy?: AtsEnginePolicy): AtsAi {
  if (!config.ai.apiKey) throw new ApiError(503, "AI provider credentials are not configured.");

  return createAtsAi({
    provider: openAiCompatible({
      apiKey: config.ai.apiKey,
      baseUrl: config.ai.baseUrl,
      timeoutMs: config.ai.timeoutMs,
      headers: config.ai.siteUrl ? { "HTTP-Referer": config.ai.siteUrl } : undefined,
      // This deployment's gateway honours OpenRouter's `provider.require_parameters`, and has
      // always been sent it with schema requests; see the option's docs.
      requireParameters: true,
    }),
    enginePolicy,
    hooks: {
      onRetry: ({ task, attempt, error }) =>
        logger.warn("Retrying ATS AI task", {
          requestId,
          task,
          attempt,
          code: error.code,
          error: error.message,
        }),
    },
  });
}

/**
 * What a credit ledger entry records about the model call behind it. Token counts are `null`
 * when the provider reported none: unknown, which a ledger must not record as free. Not the
 * model id: those resolve from private configuration and the ledger is user-facing data.
 */
function aiMetadata(outcome: AtsAiResult<unknown>) {
  const usage = outcome.usage;
  return {
    promptVersion: outcome.promptVersion,
    attempts: outcome.attempts,
    rejectedValues: outcome.rejected.length,
    // Summed over every attempt: a retried call was billed by the provider too.
    promptTokens: usage?.inputTokens ?? null,
    completionTokens: usage?.outputTokens ?? null,
    totalTokens: usage ? usage.inputTokens + usage.outputTokens : null,
  };
}

/** Log fields for a failed task. */
export function aiFailure(error: unknown) {
  if (error instanceof AtsAiError)
    return {
      code: error.code,
      status: error.status,
      attempts: error.attempts,
      error: error.message,
    };
  return { error: error instanceof Error ? error.message : "Unknown provider error" };
}

/**
 * Releases a reservation from an error path without letting that release mask the error being
 * handled. With the database or Redis down the release itself fails; the caller still returns
 * the original failure, and the expiry sweep returns the credits when the TTL lapses.
 */
export async function releaseReservationQuietly(
  userId: string,
  requestId: string,
  context: Record<string, unknown> = {},
) {
  try {
    await CreditService.releaseReservation(userId, requestId);
  } catch (error) {
    logger.error("Credit reservation release failed; the expiry sweep will return it", {
      requestId,
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type BilledRun<T> = {
  userId: string;
  requestId: string;
  credits: number;
  action: string;
  /** Ledger reason, also the log subject: "AI ATS analysis". */
  reason: string;
  failure: string;
  metadata?: Record<string, unknown>;
  run: () => Promise<AtsAiResult<T>>;
};

/** A completed task whose reservation is still open: the caller decides when it is paid for. */
export type HeldResult<T> = {
  outcome: AtsAiResult<T>;
  /** Charges the reservation. Throws (after releasing) when the ledger refuses the commit. */
  commit(): Promise<void>;
  /** Hands the credits back. Never throws. */
  release(): Promise<void>;
};

/**
 * Reserves, runs, and hands back the result with its reservation still pending.
 *
 * Parse repair uses this (V-036): its result is only worth paying for when the analysis it was
 * done for is delivered, so the controller commits it after the analysis and releases it when
 * the analysis fails. A task that failed, including one the request's signal aborted, has its
 * reservation released here before the error goes up. A failure the caller should see as-is is
 * an `ApiError`; an abort is a 504; anything else is the provider's and becomes a 502 with
 * `failure` as its message.
 */
export async function runReserved<T>(options: BilledRun<T>): Promise<HeldResult<T>> {
  const { userId, requestId } = options;
  await CreditService.reserve(userId, options.credits, options.action, requestId);

  let outcome: AtsAiResult<T>;
  try {
    outcome = await options.run();
  } catch (error) {
    await releaseReservationQuietly(userId, requestId, { reason: options.reason });
    // A reply that filled nothing is the model finding nothing, not a fault: released, and
    // rethrown with its code so the caller can say so.
    if (error instanceof AtsAiError && error.code === "unusable") {
      logger.warn(`${options.reason} found nothing to add`, { requestId, ...aiFailure(error) });
      throw error;
    }
    logger.error(`${options.reason} failed`, { requestId, ...aiFailure(error) });
    if (error instanceof ApiError) throw error;
    if (error instanceof AtsAiError && error.code === "aborted") throw aiTimeoutError();
    throw new ApiError(502, options.failure);
  }

  let settled = false;
  return {
    outcome,
    commit: async () => {
      if (settled) return;
      settled = true;
      try {
        await CreditService.commitReservation(userId, requestId, {
          referenceId: outcome.responseId,
          reason: options.reason,
          metadata: { ...options.metadata, ...aiMetadata(outcome) },
        });
      } catch (error) {
        await releaseReservationQuietly(userId, requestId, { reason: options.reason });
        logger.error(`${options.reason} could not be charged`, { requestId, ...aiFailure(error) });
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, options.failure);
      }
    },
    release: async () => {
      if (settled) return;
      settled = true;
      await releaseReservationQuietly(userId, requestId, { reason: options.reason });
    },
  };
}

/**
 * Runs a task on one credit reservation: reserve, run, commit with the call's metadata — or,
 * on any failure, release the reservation and report it.
 *
 * Every billed AI path goes through here or `runReserved`, so the reservation is released on
 * every failure path there is, including a commit that fails.
 */
export async function runBilled<T>(options: BilledRun<T>): Promise<AtsAiResult<T>> {
  const held = await runReserved(options);
  await held.commit();
  return held.outcome;
}
