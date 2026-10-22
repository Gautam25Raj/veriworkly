import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  TYPE_META,
  changelogEntryHref,
  formatChangelogDate,
} from "@/features/changelog/utils/changelog-utils";
import ChangelogRichText from "@/features/changelog/components/detail/ChangelogRichText";
import { TYPE } from "@/components/marketing/PageLayout";
import CardCategories from "./CardCategories";
import CardAuthors from "./CardAuthors";
import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";

interface ChangelogEntryCardProps {
  entry: ChangelogEntry;
  isLatest: boolean;
}

/** One release as a ledger row: the version on the left, what it changed on the right. */
const ChangelogEntryCard = ({ entry, isLatest }: ChangelogEntryCardProps) => {
  const typeMeta = TYPE_META[entry.type];

  return (
    <Link
      id={entry.id}
      href={changelogEntryHref(entry.id)}
      className="group hover:bg-card focus-visible:bg-card focus-visible:ring-accent/40 -mx-4 grid scroll-mt-28 gap-4 rounded-3xl px-4 py-6 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:-mx-7 sm:px-7 md:grid-cols-[11rem_minmax(0,1fr)_auto] md:gap-10"
    >
      <div>
        <p className="text-xl font-bold tracking-tight tabular-nums">v{entry.version}</p>
        <time dateTime={entry.publishedAt} className="text-muted mt-1 block text-base">
          {formatChangelogDate(entry.publishedAt)}
        </time>
        <p className="mt-3 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${typeMeta.className}`}>
            {typeMeta.label}
          </span>
          {isLatest && (
            <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-sm font-semibold">
              Latest
            </span>
          )}
        </p>
      </div>

      <div className="min-w-0">
        <h2
          className={`group-hover:text-accent text-balance transition-colors duration-200 ${TYPE.title}`}
        >
          {entry.title}
        </h2>

        {entry.summary && (
          <p className="text-muted mt-2 line-clamp-2 max-w-3xl text-base leading-7 text-pretty">
            <ChangelogRichText content={entry.summary} inline />
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <CardCategories entry={entry} />
          <CardAuthors prRefs={entry.prRefs ?? []} />
        </div>
      </div>

      <ArrowRight
        aria-hidden="true"
        className="text-muted group-hover:text-accent hidden size-6 self-center transition-transform duration-200 group-hover:translate-x-1 md:block"
      />
    </Link>
  );
};

export default ChangelogEntryCard;
