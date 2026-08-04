import type { AtsQuota } from "@/features/ats-checker/types";

/**
 * The reset window differs by tier (48h anonymous, 24h signed in, billing period on a paid
 * plan), so the copy has to come from `resetsAt` rather than being written into the component.
 * The previous hard-coded "resets in a couple of days" was simply wrong for two of the three
 * tiers.
 */
export function resetCopy(resetsAt: string): string {
  const target = new Date(resetsAt).getTime();
  if (Number.isNaN(target)) return "soon";

  const minutes = Math.max(0, Math.round((target - Date.now()) / 60_000));
  if (minutes < 1) return "in under a minute";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function allowanceCopy(quota: AtsQuota): string {
  const window =
    quota.tier === "anonymous"
      ? "every 48 hours"
      : quota.tier === "free"
        ? "a day"
        : "this billing period";
  return `${quota.limit} scan${quota.limit === 1 ? "" : "s"} ${window}`;
}
