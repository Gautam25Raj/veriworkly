import type { DocumentImportDraft } from "@/features/documents/core/definition";

import type { CoverLetterContent } from "./types";

import { COVER_LETTER_TEMPLATE_ID } from "./defaults";
import { parseCoverLetterContent } from "./schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `senderName` is on every cover letter's content and on no other document type's. */
function isCoverLetterContent(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.senderName === "string";
}

/**
 * Parses a cover letter JSON file into a new document's content.
 *
 * This lived inline in `CoverLetterEditor` as sixty lines of merge logic — untestable in
 * isolation, and invisible to anyone reading `features/cover-letter/` for import handling.
 * It also merged into the *currently open* document, keeping its id and cloud linkage,
 * which is the hazard `sanitizeImportedDocument` exists to prevent. Import now creates a
 * new document for both types, matching the resume's non-destructive "restore a backup"
 * behaviour; the merge-into-current semantics are gone deliberately.
 *
 * Accepts both shapes that exist on disk: the full document envelope, which must say it is a
 * cover letter, and the bare `content` object that this app's own JSON export writes. Anything
 * else — `{}`, a resume's export — is refused rather than imported as a blank letter.
 *
 * `parseCoverLetterContent` is load-bearing and must stay: it coerces every field to its
 * declared type (page margins can never be `NaN`, link `type` is allow-listed), and it is
 * what closed a prior hole where raw untrusted JSON was merged straight into live state.
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
