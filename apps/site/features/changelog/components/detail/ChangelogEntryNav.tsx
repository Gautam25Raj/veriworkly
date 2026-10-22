import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { FRAME, TYPE } from "@/components/marketing/PageLayout";

import { changelogEntryHref } from "@/features/changelog/utils/changelog-utils";
import { type ChangelogIndexItem } from "@/features/changelog/services/changelog-backend";

const cellClass =
  "group bg-background focus-visible:ring-accent/40 flex flex-col gap-3 rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.99] sm:p-8";

const ChangelogEntryNav = ({
  older,
  newer,
}: {
  older: ChangelogIndexItem | null;
  newer: ChangelogIndexItem | null;
}) => (
  <nav aria-label="Adjacent releases" className="bg-card border-border border-y py-14 lg:py-16">
    <div className={`${FRAME} grid gap-4 sm:grid-cols-2`}>
      {older ? (
        <Link className={cellClass} href={changelogEntryHref(older.id)}>
          <span className="text-muted flex items-center gap-2 text-base">
            <ArrowLeft
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
            />
            Previous release
          </span>
          <span className={TYPE.figure}>v{older.version}</span>
          <span className="text-muted line-clamp-2 text-base">{older.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      {newer ? (
        <Link
          className={`${cellClass} sm:items-end sm:text-right`}
          href={changelogEntryHref(newer.id)}
        >
          <span className="text-muted flex items-center gap-2 text-base">
            Next release
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
          <span className={TYPE.figure}>v{newer.version}</span>
          <span className="text-muted line-clamp-2 text-base">{newer.title}</span>
        </Link>
      ) : (
        <Link className={`${cellClass} sm:items-end sm:text-right`} href="/roadmap">
          <span className="text-muted flex items-center gap-2 text-base">
            This is the newest release
          </span>
          <span className={TYPE.figure}>What&apos;s next</span>
          <span className="text-accent flex items-center gap-2 text-base font-semibold">
            See the roadmap
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </Link>
      )}
    </div>
  </nav>
);

export default ChangelogEntryNav;
