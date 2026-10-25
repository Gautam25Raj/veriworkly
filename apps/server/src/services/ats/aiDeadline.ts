import type { Response } from "express";

import { ApiError } from "#lib/errors";

/**
 * The time budget every billed AI call on a request shares (V-034).
 *
 * `AI_REQUEST_DEADLINE_MS` is the longest one request may keep a provider busy, parse repair
 * and analysis included. It sits under Cloudflare's 100 s with room for the job-page fetch that
 * can precede it, and far under the 15-minute credit reservation TTL (`creditService.ts`), so a
 * reservation can no longer expire under a call that is still running. Every provider call
 * carries a signal that fires at this deadline or when the client goes away; either way the
 * call ends and its reservation is released, instead of charging for an answer nobody received.
 *
 * Kept free of heavy imports: the rate limiter sizes its in-flight slots from the deadline.
 */
export const AI_REQUEST_DEADLINE_MS = 85_000;

/** The engine waits 1 s before the first retry of a provider fault and doubles each time after. */
function backoffBeforeRetry(retry: number) {
  return 1_000 * 2 ** (retry - 1);
}

const RETRY_CEILING = 2;

/**
 * The most retries whose worst case — every attempt running to `timeoutMs`, plus the backoff
 * between attempts — still fits the deadline. With the 45 s default timeout that is none; 30 s
 * allows one retry, 20 s two. The ATS policy reader clamps each route to this, so no route can
 * be configured into a budget the deadline would cut off midway through a billed attempt.
 */
export function maxRetriesWithinDeadline(timeoutMs: number, deadlineMs = AI_REQUEST_DEADLINE_MS) {
  let retries = 0;
  let total = timeoutMs;
  while (retries < RETRY_CEILING) {
    const next = total + backoffBeforeRetry(retries + 1) + timeoutMs;
    if (next > deadlineMs) break;
    total = next;
    retries += 1;
  }
  return retries;
}

/**
 * Aborts when the client goes away before the response is written.
 *
 * Watched on the response, not the request: Node emits the request's `close` when the request
 * has completed, whether or not the connection stayed up, so it is not a disconnect signal. The
 * response's `close` without `writableFinished` is one.
 */
export function requestClosedSignal(res: Response): AbortSignal {
  const controller = new AbortController();
  const gone = () => controller.abort(new Error("Client disconnected."));
  // Already gone before anyone asked: a long job fetch can precede the first provider call.
  if (res.destroyed || res.writableEnded) gone();
  else
    res.once("close", () => {
      if (!res.writableFinished) gone();
    });
  return controller.signal;
}

/** The signal every provider call on this request gets: the client leaving, or the deadline. */
export function aiRequestSignal(res: Response): AbortSignal {
  return AbortSignal.any([requestClosedSignal(res), AbortSignal.timeout(AI_REQUEST_DEADLINE_MS)]);
}

/** What an aborted call answers with when there is still someone to answer. */
export function aiTimeoutError() {
  return new ApiError(504, "The AI request timed out before the provider answered.");
}
