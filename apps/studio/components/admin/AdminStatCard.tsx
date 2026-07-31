import Link from "next/link";
import type { ReactNode } from "react";

import { Card, cn } from "@veriworkly/ui";

export type AdminStatTone = "default" | "positive" | "warning" | "critical";

const toneStyles: Record<AdminStatTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: AdminStatTone;
  href?: string;
}

/**
 * A single number with its label. `href` turns the whole card into a link to the page that
 * can act on it — an operator seeing "3 pending withdrawals" should be one click from the
 * queue, not hunting for it in the nav.
 */
const AdminStatCard = ({ label, value, hint, tone = "default", href }: AdminStatCardProps) => {
  const body = (
    <Card
      className={cn(
        "h-full space-y-1.5 rounded-3xl p-5",
        href && "transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      <p className="text-muted text-xs font-medium tracking-wide uppercase">{label}</p>

      <p className={cn("text-2xl font-semibold tracking-tight", toneStyles[tone])}>{value}</p>

      {hint ? <p className="text-muted text-xs leading-5">{hint}</p> : null}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
};

export default AdminStatCard;
