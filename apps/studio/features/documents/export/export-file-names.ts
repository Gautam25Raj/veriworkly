import type { BaseDocument } from "@/features/documents/core/types";
import type { CoverLetterContent } from "@/features/cover-letter/types";

import { sanitizeFileName } from "@/features/documents/utils/formatters";

export function getDocumentFileBaseName(document: BaseDocument): string {
  if (document.type !== "COVER_LETTER") {
    return sanitizeFileName(document.title) || document.type.toLowerCase();
  }

  const content = document.content as Partial<CoverLetterContent>;
  const fromTitle = sanitizeFileName(document.title);
  const fromContent = sanitizeFileName(
    [content.senderName, content.companyName, "cover-letter"].filter(Boolean).join(" "),
  );

  return fromTitle || fromContent || "cover-letter";
}
