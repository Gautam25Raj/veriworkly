import { cn } from "@veriworkly/ui";

import { humanizeKey } from "@/features/admin/utils/admin-format";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 ring-zinc-500/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  danger: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20",
};

/**
 * One mapping for every status enum in the admin surface. Centralised so "ACTIVE" is the same
 * green on the users table, the affiliates table and the subscriptions table — inconsistent
 * status colours are how an operator misreads a row.
 */
const STATUS_TONES: Record<string, Tone> = {
  // Lifecycle / moderation
  ACTIVE: "success",
  LIVE: "success",
  APPROVED: "success",
  PROCESSED: "success",
  AVAILABLE: "success",
  READY: "success",
  CONVERTED: "success",
  PAID: "success",
  ok: "success",

  PENDING: "warning",
  REQUESTED: "warning",
  PROCESSING: "warning",
  TRIALING: "warning",
  GRACE: "warning",
  PAST_DUE: "warning",
  degraded: "warning",
  SIGNED_UP: "warning",

  SUSPENDED: "danger",
  REJECTED: "danger",
  FAILED: "danger",
  REVERSED: "danger",
  CANCELED: "danger",
  down: "danger",

  INACTIVE: "neutral",
  NOT_ENROLLED: "neutral",
  NONE: "neutral",

  // Visibility
  PUBLIC: "info",
  UNLISTED: "warning",
  PRIVATE: "neutral",

  // Affiliate tiers
  TIER_1: "neutral",
  TIER_2: "info",
  TIER_3: "success",

  // Roles
  ADMIN: "danger",
  AMBASSADOR: "info",
  USER: "neutral",
};

interface AdminStatusBadgeProps {
  status: string | null | undefined;
  /** Overrides the lookup when a status word means something different in context. */
  tone?: Tone;
  className?: string;
}

const AdminStatusBadge = ({ status, tone, className }: AdminStatusBadgeProps) => {
  if (!status) return <span className="text-muted text-xs">—</span>;

  const resolvedTone = tone ?? STATUS_TONES[status] ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        toneStyles[resolvedTone],
        className,
      )}
    >
      {humanizeKey(status)}
    </span>
  );
};

export default AdminStatusBadge;
