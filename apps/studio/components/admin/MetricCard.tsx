import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@veriworkly/ui";

import Sparkline from "@/components/admin/charts/Sparkline";
import type { ChartSeries } from "@/components/admin/charts/ChartDefs";
import { formatPercent } from "@/features/admin/utils/admin-format";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Sub-line under the value. One short clause — this is context, not a second metric. */
  hint?: ReactNode;
  /** Percent change vs the previous comparable window. `null` renders as "no baseline". */
  delta?: number | null;
  /**
   * Set when a rise is bad (failed webhooks, churn). Without it, up is assumed good and would
   * be coloured green — which is actively misleading on a failure count.
   */
  invertDelta?: boolean;
  trend?: number[];
  series?: ChartSeries;
  href?: string;
  className?: string;
}

/**
 * A primary KPI: the number, how it is moving, and its shape over the window.
 *
 * The card is the whole link target when `href` is set. An operator reading "12 pending
 * withdrawals" should be one click from the queue that drains them, and making only the label
 * clickable puts a 4px target inside a 120px card.
 */
const MetricCard = ({
  label,
  value,
  hint,
  delta,
  invertDelta = false,
  trend,
  series = 1,
  href,
  className,
}: MetricCardProps) => {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const rising = hasDelta && delta > 0;

  // "Good" is direction-dependent, not sign-dependent: more signups is good, more failed
  // webhooks is not. A flat delta stays neutral either way.
  const deltaTone =
    !hasDelta || delta === 0
      ? "text-muted bg-admin-inset"
      : rising !== invertDelta
        ? "text-success bg-success/10"
        : "text-destructive bg-destructive/10";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="admin-label text-muted">{label}</p>

        {href ? (
          <ArrowRight
            className="text-muted h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-foreground admin-numeric text-2xl font-semibold">{value}</p>

        {hasDelta ? (
          <span
            className={cn(
              "admin-numeric inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
              deltaTone,
            )}
          >
            {delta === 0 ? null : rising ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {formatPercent(delta)}
          </span>
        ) : null}
      </div>

      {hint ? <p className="text-muted mt-1 text-xs leading-5">{hint}</p> : null}

      {/* `mt-auto` pins the sparkline to the card's bottom edge, so across a row of four the
          trend lines share one baseline however many lines each hint wrapped to. */}
      {trend && trend.length > 1 ? (
        <div className="mt-auto pt-3">
          <Sparkline values={trend} series={series} />
        </div>
      ) : null}
    </>
  );

  const shell = cn(
    // `h-full` + column flex so a longer hint on one card doesn't leave its neighbours short:
    // the row stretches every card to the tallest anyway, and without this the sparkline sat
    // mid-card on some and at the bottom edge on others, so the four baselines never matched.
    "border-border bg-card flex h-full flex-col rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
    href &&
      "group hover:border-accent/40 focus-visible:ring-accent focus-visible:ring-offset-background transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
    className,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
};

export default MetricCard;
