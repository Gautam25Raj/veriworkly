import "server-only";

/** Used when the upstream rate is unavailable, implausible or slow; also the client bundle's first-paint value. */
export const FALLBACK_INR_PER_USD = 98;

const RATE_SOURCE = "https://open.er-api.com/v6/latest/USD";

/** Refreshed twice a day. List prices are round USD figures; nobody needs minute-level FX. */
const RATE_REVALIDATE_SECONDS = 43_200;

/** A rate outside this band is malformed or hijacked, and would render a price on a checkout page. */
const MIN_PLAUSIBLE_RATE = 40;
const MAX_PLAUSIBLE_RATE = 250;

/** Never let FX hold up a page render; the fallback is always acceptable. */
const RATE_TIMEOUT_MS = 3_000;

/** Runs on the server on purpose: a browser call was CSP-blocked and leaked every visitor's IP to a third party. */
export async function fetchInrPerUsd(): Promise<number> {
  try {
    const response = await fetch(RATE_SOURCE, {
      signal: AbortSignal.timeout(RATE_TIMEOUT_MS),
      next: { revalidate: RATE_REVALIDATE_SECONDS },
    });

    if (!response.ok) return FALLBACK_INR_PER_USD;

    const payload: unknown = await response.json();

    const rate =
      payload && typeof payload === "object"
        ? (payload as { rates?: Record<string, unknown> }).rates?.INR
        : undefined;

    if (
      typeof rate !== "number" ||
      !Number.isFinite(rate) ||
      rate < MIN_PLAUSIBLE_RATE ||
      rate > MAX_PLAUSIBLE_RATE
    ) {
      return FALLBACK_INR_PER_USD;
    }

    return rate;
  } catch {
    // Timeout, DNS failure, malformed JSON. A stale-but-sane rate beats a broken page.
    return FALLBACK_INR_PER_USD;
  }
}
