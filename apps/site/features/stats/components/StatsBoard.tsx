import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { GitHubIssuePage } from "@/features/github/services/github-backend";

import { TYPE } from "@/components/marketing/PageLayout";

import { formatRelativeTime, PAGE_SIZE, STATUS_META } from "./stats-utils";

interface StatsBoardProps {
  issuePage: GitHubIssuePage | null;
  totalItems: number;
  offset: number;
  isFiltered: boolean;
}

const StatsBoard = ({ issuePage, totalItems, offset, isFiltered }: StatsBoardProps) => {
  const items = issuePage?.items ?? [];

  const totalPages = Math.max(1, Math.ceil((issuePage?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const showingStart = totalItems === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + items.length, totalItems);

  if (items.length === 0)
    return (
      <div className="bg-card rounded-3xl px-6 py-16 text-center sm:px-10">
        <p className={TYPE.title}>
          {isFiltered ? "Nothing matches these filters." : "The board is empty."}
        </p>
        <p className="text-muted mx-auto mt-3 max-w-md text-base">
          {isFiltered ? (
            <>
              Try another status or type, or{" "}
              <Link
                href="/stats"
                className="text-accent font-semibold underline underline-offset-4"
              >
                show everything
              </Link>
              .
            </>
          ) : (
            "There are no public issues or pull requests in the latest sync."
          )}
        </p>
      </div>
    );

  return (
    <div>
      <p className="text-muted mb-4 text-base tabular-nums" aria-live="polite">
        Showing {showingStart} to {showingEnd} of {totalItems}, page {currentPage} of {totalPages}
      </p>

      <ol className="divide-border -mx-5 divide-y sm:-mx-7">
        {items.map((item) => {
          const status = STATUS_META[item.status] ?? { label: item.status, dot: "bg-muted" };
          const isPR = item.kind === "pull-request";

          return (
            <li key={item.id} className="py-1">
              <Link
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:bg-card focus-visible:bg-card focus-visible:ring-accent/40 grid gap-3 rounded-3xl px-5 py-6 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:px-7 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:gap-8"
              >
                <p className="flex items-center gap-2.5 text-base font-semibold md:self-start md:pt-1">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${status.dot}`}
                  />
                  {status.label}
                </p>

                <div className="min-w-0">
                  <h3 className="group-hover:text-accent text-xl leading-snug font-bold tracking-tight transition-colors duration-200">
                    {item.title}
                  </h3>
                  <p className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base">
                    <span className="tabular-nums">
                      {isPR ? "Pull request" : "Issue"} #{item.number}
                    </span>
                    <span>Updated {formatRelativeTime(item.updatedAt)}</span>
                    {item.labels.length > 0 && <span>{item.labels.join(", ")}</span>}
                  </p>
                </div>

                <ArrowUpRight
                  aria-hidden="true"
                  className="text-muted group-hover:text-accent hidden size-5 self-center transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 md:block"
                />
                <span className="sr-only">(opens on GitHub)</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StatsBoard;
