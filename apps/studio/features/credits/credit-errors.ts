import { ApiRequestError } from "@/utils/fetchApiData";

export type PaidActionError = { message: string; buyCredits: boolean };

/**
 * What to tell the user when a priced AI action fails. A 402 is either an empty wallet ("Not
 * enough AI credits.") or an action the account cannot use yet; both are fixed on /billing, so
 * both offer the way there. Anything else keeps the server's own message.
 */
export function describePaidActionError(error: unknown, fallback: string): PaidActionError {
  if (error instanceof ApiRequestError && error.status === 402) {
    return {
      message: /^not enough/i.test(error.message) ? "Not enough credits." : error.message,
      buyCredits: true,
    };
  }

  return { message: error instanceof Error ? error.message : fallback, buyCredits: false };
}
