import Link from "next/link";

import { cn } from "@veriworkly/ui";

import { chartColor, type ChartSeries } from "./ChartDefs";

export interface BarListItem {
  label: string;
  value: number;
  /** Turns the row into a link to the filtered list that explains the number. */
  href?: string;
}

interface BarListProps {
  items: BarListItem[];
  series?: ChartSeries;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  /** Rows beyond this are dropped; the caller sorts first. */
  limit?: number;
  className?: string;
}

/**
 * A ranked horizontal bar list — the right shape for "top templates", "users by role",
 * "referrer hosts" and every other category-to-count breakdown in the admin.
 *
 * A bar list is used here in preference to a pie or donut because these categories are read
 * comparatively ("is TIER_2 bigger than TIER_1?"), and comparing bar lengths against a shared
 * baseline is far more accurate than comparing angles. It also degrades gracefully: twelve
 * categories are still readable as a list, where a twelve-slice donut is not.
 *
 * Bars are scaled against the largest value rather than the total, so the top row always fills
 * the track and small values stay visible instead of collapsing to a sliver.
 */
const BarList = ({
  items,
  series = 1,
  formatValue = (value) => value.toLocaleString("en-US"),
  emptyMessage = "Nothing recorded yet.",
  limit,
  className,
}: BarListProps) => {
  const visible = limit ? items.slice(0, limit) : items;

  // Scaled against the largest value plus headroom, not against the largest value itself. At an
  // exact 100% the top bar fills its whole row edge to edge, which stops reading as a bar and
  // starts reading as a selected or hovered row — the leading category looked like a highlight
  // rather than a measurement. Leaving ~12% of the track empty keeps it legible as a length.
  const max = Math.max(1, ...visible.map((item) => item.value)) * 1.12;

  if (visible.length === 0) {
    return <p className="text-muted py-6 text-center text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {visible.map((item) => {
        const content = (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-[5px] transition-[width] duration-500"
              style={{
                // Floored at 2% so a long-tail category is still drawn as a bar. Admin
                // breakdowns are routinely lopsided — 28 admins against 11,840 users is 0.2% —
                // and at that width a rounded bar collapses into a 2px dot that reads as a
                // rendering artifact rather than as the smallest value in the list.
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%`,
                background: chartColor(series),
                // The bar is a backdrop for the label that sits on top of it, so it stays faint
                // enough to keep the label at full contrast.
                opacity: 0.16,
              }}
            />

            <span className="text-foreground relative z-10 min-w-0 truncate text-sm">
              {item.label}
            </span>

            <span className="text-foreground admin-numeric relative z-10 shrink-0 text-sm font-semibold">
              {formatValue(item.value)}
            </span>
          </>
        );

        return (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className="focus-visible:ring-accent relative flex items-center justify-between gap-3 overflow-hidden rounded-[5px] px-2.5 py-1.5 transition hover:brightness-[0.97] focus-visible:ring-2 focus-visible:outline-none"
              >
                {content}
              </Link>
            ) : (
              <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[5px] px-2.5 py-1.5">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default BarList;
