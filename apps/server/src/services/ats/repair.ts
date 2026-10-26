import type { AtsParsedResume, AtsReport } from "@veriworkly/ats-engine";

import { getAtsAiPolicy } from "#services/ats/aiPolicy";
import { createServerAtsAi, runReserved, taskRoute } from "#services/ats/atsAi";
import { getAtsEnginePolicy } from "#services/ats/enginePolicy";
import { logger } from "#lib/logger";

/**
 * AI repair of a bad deterministic parse.
 *
 * The deterministic parser stays primary: it is free, runs in about a millisecond, is
 * explainable line by line, and cannot invent an employer. That last property is the product,
 * so this pass never replaces it — it only fills fields the regex parser failed to recover, on
 * documents where it demonstrably failed, for users who pay for it.
 *
 * Where regexes generalise badly is exactly where a model does not: unknown section headings,
 * stacked headers, two-column layouts whose text extraction interleaves, and non-English
 * documents. Those are the trigger conditions below.
 *
 * When to offer repair (`needsRepair`), the model call, and what to accept from the model
 * (`mergeGrounded`) live in `@veriworkly/ats-engine`; this module owns billing. Like every AI
 * action it needs credits from any source and no plan (owner decision 1, V-178).
 * Everything the model returns is checked against the source text before it is used.
 */

export type RepairOutcome = {
  repaired: AtsParsedResume | null;
  /** What `commit` charges. Not yet spent when this is returned. */
  creditsSpent: number;
  /** Values the model returned that do not occur in the source. Dropped, and reported. */
  rejectedValues: number;
  /**
   * Charges the repair. The repaired parse is only worth paying for once the analysis it feeds
   * is being delivered, so the caller commits after that analysis succeeds (V-036).
   */
  commit(): Promise<void>;
  /** Hands the credits back: the repaired parse is not being delivered. Never throws. */
  release(): Promise<void>;
};

const noop = async () => undefined;

/**
 * Runs the repair pass and returns the deterministic parse with its gaps filled from grounded AI
 * values, with the charge held open until the caller settles it. `repaired` is `null` only when
 * this deployment has no repair route; `commit` and `release` are then no-ops.
 *
 * The merge is one-directional: AI values only ever fill a field the deterministic parser left
 * empty. A model does not get to overwrite something the regex parser was confident about, so
 * the worst case for an existing correct value is that it stays.
 */
export class AtsRepairService {
  static async repair(
    userId: string,
    requestId: string,
    resumeText: string,
    report: AtsReport,
    /** Ends the provider call when the client leaves or the request deadline passes (V-034). */
    signal?: AbortSignal,
  ): Promise<RepairOutcome> {
    const policy = getAtsAiPolicy();
    const route = policy.parseRepair;
    if (!route)
      return { repaired: null, creditsSpent: 0, rejectedValues: 0, commit: noop, release: noop };

    const held = await runReserved({
      userId,
      requestId,
      credits: route.credits,
      action: "ats_parse_repair",
      reason: "AI parse repair",
      failure: "AI parse repair could not be completed.",
      run: () =>
        createServerAtsAi(requestId, getAtsEnginePolicy()).repairParse(
          { resumeText, report },
          { ...taskRoute(route, policy.prompts.parseRepair), signal },
        ),
    });

    // Dropped values are still billed: the user got a real repair attempt, and the grounding
    // check catching a fabricated value is the feature working.
    const rejectedValues = held.outcome.rejected.length;
    if (rejectedValues > 0) {
      logger.warn("AI parse repair returned ungrounded values", {
        requestId,
        rejectedValues,
        paths: held.outcome.rejected.map((violation) => violation.path).slice(0, 20),
      });
    }
    return {
      repaired: held.outcome.result,
      creditsSpent: route.credits,
      rejectedValues,
      commit: held.commit,
      release: held.release,
    };
  }
}
