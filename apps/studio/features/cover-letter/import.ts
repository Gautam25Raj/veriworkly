import type { DocumentImportDraft } from "@/features/documents/core/definition";

import type { CoverLetterContent } from "./types";

import { COVER_LETTER_TEMPLATE_ID } from "./defaults";
import { parseCoverLetterContent } from "./schema";
import { isRecord } from "@/lib/is-record";

/** `senderName` is on every cover letter's content and on no other document type's. */
function isCoverLetterContent(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.senderName === "string";
}

/**
 * Parses a cover letter JSON file into a new document's content.
 *
 * Import creates a new document, never merging into the open one: merging would keep its id
 * and cloud linkage, the hazard `sanitizeImportedDocument` exists to prevent.
 *
 * Accepts both shapes that exist on disk: the full document envelope, which must say it is a
 * cover letter, and the bare `content` object that this app's own JSON export writes. Anything
 * else — `{}`, a resume's export — is refused rather than imported as a blank letter.
 *
 * `parseCoverLetterContent` is load-bearing and must stay: it coerces every field to its
 * declared type (page margins can never be `NaN`, link `type` is allow-listed), so raw
 * untrusted JSON never reaches live state.
 */
export function importCoverLetterJson(
  raw: unknown,
): DocumentImportDraft<CoverLetterContent> | null {
  if (!isRecord(raw)) return null;

  const envelope = isRecord(raw.content) ? raw : null;

  if (envelope && envelope.type !== "COVER_LETTER") return null;

  const rawContent = envelope ? envelope.content : raw;

  if (!isCoverLetterContent(rawContent)) return null;

  const content = parseCoverLetterContent(rawContent);

  const envelopeTitle = envelope && typeof envelope.title === "string" ? envelope.title : "";
  const envelopeTemplateId =
    envelope && typeof envelope.templateId === "string" ? envelope.templateId : "";

  return {
    // Same derivation the store uses when the target changes, so an imported bare-content
    // file still lands in the library with a meaningful name.
    title:
      envelopeTitle ||
      [content.jobTitle, content.companyName].filter(Boolean).join(" - ") ||
      "Untitled Cover Letter",
    templateId: envelopeTemplateId || COVER_LETTER_TEMPLATE_ID,
    content,
  };
}
