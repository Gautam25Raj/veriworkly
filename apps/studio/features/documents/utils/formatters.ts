"use client";

export function safeText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

/**
 * Renders only the date parts the user actually filled in — never a placeholder like
 * "Start"/"End". A resume export must never contain literal placeholder text; if both
 * dates are empty (and the entry isn't marked "current"), this returns "" so callers
 * can omit the date line entirely instead of printing a fake range.
 */
export function formatDateRange(startDate: string, endDate: string, current: boolean): string {
  const start = safeText(startDate);
  const end = current ? "Present" : safeText(endDate);

  if (start && end) return `${start} - ${end}`;
  return start || end;
}

/**
 * A file name from a title in any script: letters, marks and digits are kept, every other
 * run of characters becomes one "-". An ASCII-only rule turned "Résumé" into "rsum" and a
 * name in Devanagari or kanji into nothing at all.
 */
export function sanitizeFileName(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
