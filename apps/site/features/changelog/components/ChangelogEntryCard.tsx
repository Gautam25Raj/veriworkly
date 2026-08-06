import Link from "next/link";
import Image from "next/image";
import { ArrowRight, GitPullRequest } from "lucide-react";

import { Card } from "@veriworkly/ui";

import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";
import {
  categoryCountsFor,
  changelogEntryHref,
  formatChangelogDate,
  TYPE_META,
} from "./changelog-utils";

const MAX_VISIBLE_TAGS = 4;
const MAX_VISIBLE_AUTHORS = 4;

/**
 * Deliberately a summary, not the release. The card used to render every Added/Improved/Fixed
 * bullet plus the full PR list, which made a single release taller than the viewport and buried
 * the next one — the full record lives on `/changelog/[id]` and the card links to it.
 */
const ChangelogEntryCard = ({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) => {
  const counts = categoryCountsFor(entry);
  const typeMeta = TYPE_META[entry.type];
  const href = changelogEntryHref(entry.id);

  const visibleTags = entry.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = entry.tags.length - visibleTags.length;

  const prRefs = entry.prRefs ?? [];
  const authors = prRefs
    .map((pr) => pr.author)
    .filter((author): author is NonNullable<typeof author> => Boolean(author))
    .filter(
      (author, index, all) => all.findIndex((other) => other.login === author.login) === index,
    )
    .slice(0, MAX_VISIBLE_AUTHORS);

  return (
    <Card
      id={entry.id}
      className="hover:border-border focus-within:border-border group scroll-mt-28 p-0 transition-colors"
    >
      {/*
       * One link over the whole card rather than a link per element: the card has no other
       * interactive content, so nesting anchors here would only cost keyboard users extra tab
       * stops for destinations that are all the same page.
       */}
      <Link href={href} className="block p-6 focus:outline-none sm:p-7">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <span className="text-foreground font-mono text-lg font-bold tracking-tight">
            v{entry.version}
          </span>

          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase ${typeMeta.className}`}
          >
            {typeMeta.label}
          </span>

          {isLatest && (
            <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase">
              Latest
            </span>
          )}

          <time
            dateTime={entry.publishedAt}
            className="text-muted ml-auto font-mono text-[11px] tracking-wide"
          >
            {formatChangelogDate(entry.publishedAt)}
          </time>
        </div>

        <h2 className="text-foreground group-hover:text-accent mt-3 font-sans text-xl font-bold tracking-tight transition-colors sm:text-2xl">
          {entry.title}
        </h2>

        {entry.summary && (
          <p className="text-muted mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed">
            {entry.summary}
          </p>
        )}

        {counts.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {counts.map(({ category, count, label, dot, text }) => (
              <li key={category} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                <span className={`font-mono text-[11px] font-bold tracking-wide ${text}`}>
                  {count}
                </span>
                <span className="text-muted font-mono text-[11px] tracking-wide">{label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-border/30 mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-4">
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted/10 text-muted border-border/30 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide"
                >
                  #{tag}
                </span>
              ))}

              {hiddenTagCount > 0 && (
                <span className="text-muted/70 font-mono text-[10px] tracking-wide">
                  +{hiddenTagCount}
                </span>
              )}
            </div>
          )}

          {prRefs.length > 0 && (
            <div className="text-muted flex items-center gap-2">
              {authors.length > 0 && (
                <div className="flex -space-x-1.5">
                  {authors.map((author) => (
                    <Image
                      key={author.login}
                      src={author.avatarUrl}
                      alt={author.login}
                      title={author.login}
                      width={18}
                      height={18}
                      className="ring-card rounded-full ring-2"
                    />
                  ))}
                </div>
              )}

              <span className="flex items-center gap-1 font-mono text-[11px] tracking-wide">
                <GitPullRequest className="h-3 w-3 shrink-0" aria-hidden="true" />
                {prRefs.length} PR{prRefs.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <span className="text-accent ml-auto inline-flex items-center gap-1.5 font-sans text-xs font-semibold whitespace-nowrap">
            Release notes
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </Card>
  );
};

export default ChangelogEntryCard;
