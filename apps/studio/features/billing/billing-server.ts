import "server-only";

import { serverFetchData } from "@/lib/server-fetch";
import { ApiRequestError } from "@/utils/fetchApiData";

/**
 * `null` when there is nothing to show: no session (401) or no record (404). Any other failure
 * throws to the dashboard error boundary, so an outage never renders as "$0.00" or "No
 * commissions yet".
 */
export async function getBillingServerData<T>(path: string): Promise<T | null> {
  try {
    return await serverFetchData<T>(path, { notFoundAsNull: true });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}

export const PROGRAM_UNAVAILABLE = Symbol("program-unavailable");

/**
 * A growth-program read (affiliate, ambassador). The server answers 503 for the whole program
 * while its flag is off; that is "the program is closed", not "you have not joined". The
 * feature-flag middleware sends no error code, so its message is the only marker.
 */
export async function getProgramServerData<T>(
  path: string,
): Promise<T | null | typeof PROGRAM_UNAVAILABLE> {
  try {
    return await getBillingServerData<T>(path);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      error.status === 503 &&
      !error.code &&
      error.message.includes("is not available yet")
    ) {
      return PROGRAM_UNAVAILABLE;
    }

    throw error;
  }
}
