import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@veriworkly/ui";

export type AdminStatTone = "default" | "positive" | "warning" | "critical";

/**
 * Tones come from the theme's semantic tokens rather than raw palette steps, matching
 * `AdminStatusBadge`. See the note there on why the admin no longer hardcodes `emerald-600`
 * and friends.
 */
const toneStyles: Record<AdminStatTone, string> = {
  default: "text-foreground",
  positive: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

const accentStyles: Record<AdminStatTone, string> = {
  default: "",
  positive: "border-success/30",
  warning: "border-warning/30",
  critical: "border-destructive/30",
};

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: AdminStatTone;
  href?: string;
  className?: string;
}

/**
 * A single number with its label — the summary stat used across the inner admin pages.
 *
 * `href` turns the whole card into a link to the page that can act on it: an operator seeing
 * "3 pending withdrawals" should be one click from the queue, not hunting for it in the nav,
 * and making only the label clickable puts a 4px target inside a 100px card.
 *
 * For the dashboard's primary KPIs use `MetricCard` instead — it adds a delta and a sparkline.
 * This one is for secondary stats where a trend line would be noise.
 */
const AdminStatCard = ({
  label,
  value,
  hint,
  tone = "default",
  href,
  className,
}: AdminStatCardProps) => {
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

      <p className={cn("admin-numeric mt-1.5 text-xl font-semibold", toneStyles[tone])}>{value}</p>

      {hint ? <p className="text-muted mt-1 text-xs leading-5">{hint}</p> : null}
    </>
  );

  const shell = cn(
    "border-border bg-card block h-full rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
    accentStyles[tone],
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

export default AdminStatCard;
