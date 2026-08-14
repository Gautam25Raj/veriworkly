import type { SaveDocumentResult } from "./local-storage-service";

export type SaveFailureReason = "quota-exceeded" | "unknown";

/**
 * User-facing text for a failed local save.
 *
 * Shared so both editors say the same thing. This wording lived inline in
 * `ResumeToolbar`, and the cover letter editor had no equivalent at all — it discarded
 * the save result, so a full-storage failure silently lost the user's edits.
 */
export function getSaveFailureMessage(reason: SaveFailureReason): string {
  if (reason === "quota-exceeded") {
    return "Storage is full. Remove older documents or exports and try again.";
  }

  return "Unable to save locally right now. Please try again.";
}

/** Returns the failure message for a save result, or `null` when it succeeded. */
export function describeSaveResult(result: SaveDocumentResult): string | null {
  return result.ok ? null : getSaveFailureMessage(result.reason);
}
