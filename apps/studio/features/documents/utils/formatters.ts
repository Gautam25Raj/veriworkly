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

/** Joins only the non-empty parts — never substitutes a placeholder for a blank one. */
export function joinTruthy(parts: Array<string | undefined | null>, separator: string): string {
  return parts
    .map((part) => safeText(part ?? ""))
    .filter(Boolean)
    .join(separator);
}

export function sanitizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
