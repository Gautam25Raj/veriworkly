/**
 * Formatting helpers shared by every admin table and stat card, so the same number never
 * renders three different ways across the dashboard.
 */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

/** Money is stored in cents everywhere in this codebase. Never format a raw cents value. */
export function formatCents(cents: number | null | undefined) {
  return currencyFormatter.format((cents ?? 0) / 100);
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function formatCompactNumber(value: number | null | undefined) {
  const numeric = value ?? 0;
  return numeric >= 10_000 ? compactNumberFormatter.format(numeric) : formatNumber(numeric);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);

  for (const [unit, size] of RELATIVE_UNITS) {
    if (absolute >= size) return relativeFormatter.format(Math.round(elapsed / size), unit);
  }

  return "just now";
}

export function formatBytes(bytes: number | null | undefined) {
  const value = bytes ?? 0;
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);

  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Math.round(seconds ?? 0));

  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;

  return `${minutes}m`;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value === null || value === undefined) return "—";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

/** Turns `affiliate.commission.create` or `PAST_DUE` into readable title case. */
export function humanizeKey(key: string) {
  return key
    .replace(/[._]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function truncate(value: string | null | undefined, length = 60) {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
