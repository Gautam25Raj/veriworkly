import Link from "next/link";
import { Clock, Gauge } from "lucide-react";

import { siteConfig } from "@/config/site";
import { allowanceCopy, resetCopy } from "../../services/quota-copy";
import type { AtsQuota } from "../../types";

export function loginHref(): string {
  return `${siteConfig.links.app}/login?callbackURL=${encodeURIComponent(
    `${siteConfig.url}/ats-checker/scan`,
  )}`;
}

export function QuotaNotice({ quota }: { quota: AtsQuota }) {
  const exhausted = quota.remaining <= 0;

  if (exhausted) {
    return (
      <div className="bg-warning/10 mb-6 flex items-start gap-3 rounded-2xl p-5">
        <Clock className="text-warning mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="text-base">
          <p className="font-semibold">You have used your {allowanceCopy(quota)}.</p>
          <p className="mt-1 leading-relaxed">
            It resets {resetCopy(quota.resetsAt)}
            {quota.tier === "anonymous" ? (
              <>
                , or{" "}
                <Link
                  href={loginHref()}
                  className="text-accent font-semibold underline underline-offset-4"
                >
                  log in free for 2 scans a day
                </Link>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <p className="text-muted mb-6 flex items-center gap-2 text-base">
      <Gauge className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="text-foreground font-semibold tabular-nums">{quota.remaining}</strong> of{" "}
        {allowanceCopy(quota)} left
        {quota.used > 0 ? <> &middot; resets {resetCopy(quota.resetsAt)}</> : null}
      </span>
    </p>
  );
}

export default QuotaNotice;
