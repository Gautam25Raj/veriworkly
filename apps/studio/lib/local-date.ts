/**
 * Helpers for `<input type="date">` values ("YYYY-MM-DD"), read in the user's own timezone.
 *
 * `new Date("YYYY-MM-DD")` is UTC midnight at the *start* of that day, so an expiry built
 * from it ends a day early, and for anyone west of UTC shows as the day before.
 */

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** The last millisecond of the chosen day, local time. */
export function endOfLocalDay(value: string): Date {
  const { year, month, day } = parseDateInput(value);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** A date as the "YYYY-MM-DD" a date input shows for it, local time. */
export function toLocalDateInput(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today as a date input's `min`. */
export function todayLocalDateInput(): string {
  return toLocalDateInput(new Date());
}

/** Tomorrow as a date input's `min`, for an expiry that must leave at least a full day. */
export function tomorrowLocalDateInput(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalDateInput(tomorrow);
}

/** The chosen day has already ended. */
export function isPastLocalDate(value: string): boolean {
  return endOfLocalDay(value).getTime() < Date.now();
}
