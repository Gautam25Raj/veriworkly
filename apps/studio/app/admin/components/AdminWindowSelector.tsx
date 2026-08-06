"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@veriworkly/ui";

/** Matches the range the backend's time-series validator accepts (floored at 7, capped at 180). */
const WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
] as const;

export const DEFAULT_WINDOW_DAYS = 30;

/**
 * Parses `?days=` into one of the offered windows.
 *
 * Exported so the dashboard's server component and this control agree on what an absent or
 * malformed param means — the previous dashboard hardcoded a 30-day window and never exposed
 * the parameter the API had accepted all along.
 */
export function parseWindowDays(value: string | undefined) {
  const parsed = Number(value);
  return WINDOWS.some((window) => window.days === parsed) ? parsed : DEFAULT_WINDOW_DAYS;
}

const AdminWindowSelector = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active = parseWindowDays(searchParams.get("days") ?? undefined);

  return (
    <div
      role="group"
      aria-label="Time window"
      className="border-border bg-card inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {WINDOWS.map((window) => (
        <button
          key={window.days}
          type="button"
          aria-pressed={active === window.days}
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            next.set("days", String(window.days));
            router.push(`/admin?${next.toString()}`);
          }}
          className={cn(
            "focus-visible:ring-accent admin-numeric rounded-[6px] px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
            active === window.days
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground hover:bg-admin-inset",
          )}
        >
          {window.label}
        </button>
      ))}
    </div>
  );
};

export default AdminWindowSelector;
