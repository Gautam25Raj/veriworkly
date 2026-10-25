import { ApiError } from "#lib/errors";

const MAX_GITHUB_FETCH_RETRIES = 3;
/** A network error or timeout says nothing about GitHub's state, so it gets fewer attempts. */
const MAX_NETWORK_RETRIES = 2;
const RETRYABLE_GITHUB_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
/** A rate limit that resets later than this fails now; waiting would only time the job out. */
const MAX_RETRY_WAIT_MS = 30_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * GitHub answers a primary rate limit (`x-ratelimit-remaining: 0`) and a secondary one
 * (`retry-after`) with 403 as well as 429; a 403 without either is a permissions problem and
 * retrying it only burns the budget.
 */
function isRetryable(response: Response): boolean {
  if (RETRYABLE_GITHUB_STATUS_CODES.has(response.status)) return true;

  return (
    response.status === 403 &&
    (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after"))
  );
}

/** The wait GitHub asks for (uncapped; the caller gives up past MAX_RETRY_WAIT_MS), else backoff. */
function resolveRetryDelayMs(response: Response, attempt: number): number {
  const retryAfterHeader = response.headers.get("retry-after");

  if (retryAfterHeader) {
    const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  if (response.status === 429 || response.status === 403) {
    const rateLimitResetHeader = response.headers.get("x-ratelimit-reset");

    if (rateLimitResetHeader) {
      const resetEpochSeconds = Number.parseInt(rateLimitResetHeader, 10);

      if (Number.isFinite(resetEpochSeconds)) {
        const untilResetMs = resetEpochSeconds * 1000 - Date.now();

        if (untilResetMs > 0) {
          return untilResetMs;
        }
      }
    }
  }

  const backoffMs = 1000 * 2 ** attempt;
  return Math.min(backoffMs, 10_000);
}

/**
 * Fetch GitHub REST API endpoint with retry handling, exponential backoff,
 * rate limit reset respect, and timeouts.
 */
export async function fetchGitHubApi(
  url: string,
  token?: string,
  options: RequestInit = {},
): Promise<Response> {
  let attempt = 0;
  let networkRetries = 0;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  while (attempt <= MAX_GITHUB_FETCH_RETRIES) {
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal ?? AbortSignal.timeout(10000),
      });
    } catch (error) {
      // A timeout or network failure throws a bare DOMException/TypeError ("This operation was
      // aborted") that names no request; the URL is what makes a job log actionable. A caller's
      // own abort is not retried.
      if (networkRetries < MAX_NETWORK_RETRIES && !options.signal?.aborted) {
        await sleep(Math.min(1000 * 2 ** networkRetries, 10_000));
        networkRetries += 1;
        continue;
      }

      throw new ApiError(502, "GitHub API request failed", {
        url,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    if (response.ok) {
      return response;
    }

    if (!isRetryable(response) || attempt === MAX_GITHUB_FETCH_RETRIES) {
      const errorBody = (await response.text()).slice(0, 500);

      throw new ApiError(502, "GitHub API communication failed", {
        url,
        status: response.status,
        body: errorBody,
      });
    }

    const delayMs = resolveRetryDelayMs(response, attempt);
    // Release the socket now rather than when the unread body is garbage-collected.
    await response.body?.cancel().catch(() => undefined);

    if (delayMs > MAX_RETRY_WAIT_MS) {
      throw new ApiError(502, "GitHub API rate limit exhausted", {
        url,
        status: response.status,
        resetAt: new Date(Date.now() + delayMs).toISOString(),
      });
    }

    await sleep(delayMs);
    attempt += 1;
  }

  throw new ApiError(502, "GitHub API communication failed");
}
