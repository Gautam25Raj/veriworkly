import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";

import {
  type ChangelogEntry,
  type ChangelogIndexItem,
} from "@/features/changelog/services/changelog-backend";

import { FRAME, TYPE } from "@/components/marketing/PageLayout";

import ReleaseTags from "./ReleaseTags";
import ChangelogRichText from "./ChangelogRichText";
import ReleaseActionLinks from "./ReleaseActionLinks";
import ReleaseContributors from "./ReleaseContributors";
import ReleasePullRequests from "./ReleasePullRequests";
import ReleaseCategorySections from "./ReleaseCategorySections";

import {
  categoriesFor,
  formatChangelogDate,
  TYPE_META,
} from "@/features/changelog/utils/changelog-utils";

function getReleaseContributors(entry: ChangelogEntry) {
  const seen = new Map<string, { login: string; avatarUrl: string; htmlUrl: string }>();

  if (entry.prRefs)
    for (const pr of entry.prRefs) {
      if (pr.author?.login)
        seen.set(pr.author.login.toLowerCase(), {
          login: pr.author.login,
          avatarUrl: pr.author.avatarUrl,
          htmlUrl: pr.author.htmlUrl,
        });
    }

  const allText = [
    entry.summary ?? "",
    ...(entry.added ?? []),
    ...(entry.improved ?? []),
    ...(entry.fixed ?? []),
    ...(entry.breaking ?? []),
    ...(entry.security ?? []),
  ].join(" ");

  const mentions = allText.match(/(?:^|\s)@([a-zA-Z0-9_-]+)(?=[\s,.:;!?)\]]|$)/g);

  if (mentions) {
    for (const m of mentions) {
      const username = m.trim().replace(/^@/, "");

      if (
        username &&
        username.length >= 2 &&
        username.toLowerCase() !== "veriworkly" &&
        username.toLowerCase() !== "veriworkl" &&
        !username.includes("npm")
      ) {
        const lower = username.toLowerCase();

        if (!seen.has(lower))
          seen.set(lower, {
            login: username,
            avatarUrl: `https://github.com/${username}.png`,
            htmlUrl: `https://github.com/${username}`,
          });
      }
    }
  }

  return Array.from(seen.values());
}

interface ChangelogEntryDetailProps {
  entry: ChangelogEntry;
  older: ChangelogIndexItem | null;
  isLatest: boolean;
}

const RAIL_HEADING = "text-muted text-sm font-semibold";

const ChangelogEntryDetail = ({ entry, older, isLatest }: ChangelogEntryDetailProps) => {
  const typeMeta = TYPE_META[entry.type];
  const categories = categoriesFor(entry);

  const prRefs = entry.prRefs ?? [];
  const contributors = getReleaseContributors(entry);

  const compareUrl = older
    ? `${siteConfig.links.github}/compare/Release-v${older.version}...Release-v${entry.version}`
    : null;

  return (
    <article>
      <header className="border-border border-b pt-28 pb-16 lg:pt-36 lg:pb-20">
        <div className={FRAME}>
          <Link
            href="/changelog"
            className="text-muted hover:text-foreground group focus-visible:ring-accent/40 inline-flex items-center gap-2 rounded-full text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
            />
            All releases
          </Link>

          <div className="mt-8 grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
            {/* The version is the release's own name, so it is the display line. */}
            <h1 className="min-w-0">
              <span className={cn("block", TYPE.display)}>v{entry.version}</span>
              <span className={cn("mt-5 block max-w-2xl text-balance", TYPE.title)}>
                {entry.title}
              </span>
            </h1>

            <div className="border-border hero-rise min-w-0 border-t pt-6">
              <p className="flex flex-wrap items-center gap-2 text-base">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${typeMeta.className}`}
                >
                  {typeMeta.label} release
                </span>
                {isLatest && (
                  <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-sm font-semibold">
                    Latest
                  </span>
                )}
                <time dateTime={entry.publishedAt} className="text-muted ml-1">
                  {formatChangelogDate(entry.publishedAt)}
                </time>
              </p>

              {entry.summary && (
                <ChangelogRichText
                  multiline
                  content={entry.summary}
                  className={cn("text-muted mt-5 text-pretty", TYPE.lede)}
                />
              )}

              <ReleaseActionLinks
                compareUrl={compareUrl}
                olderVersion={older?.version}
                githubUrl={entry.githubUrl}
              />
            </div>
          </div>
        </div>
      </header>

      <div
        className={`${FRAME} grid gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-20 lg:py-20`}
      >
        <div className="min-w-0 space-y-16">
          <ReleaseCategorySections entry={entry} />
          <ReleasePullRequests prRefs={prRefs} />
        </div>

        <aside className="space-y-10 lg:sticky lg:top-28 lg:self-start">
          {categories.length > 0 && (
            <nav aria-label="In this release">
              <h2 className={RAIL_HEADING}>In this release</h2>
              <ul className="mt-4 space-y-1">
                {categories.map(({ category, label, items, dot }) => (
                  <li key={category}>
                    <a
                      href={`#${category}`}
                      className="hover:bg-card focus-visible:ring-accent/40 -mx-3 flex items-center gap-3 rounded-xl px-3 py-2 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
                      <span className="flex-1 font-medium">{label}</span>
                      <span className="text-muted tabular-nums">{items.length}</span>
                    </a>
                  </li>
                ))}
                {prRefs.length > 0 && (
                  <li>
                    <a
                      href="#pull-requests"
                      className="hover:bg-card focus-visible:ring-accent/40 -mx-3 flex items-center gap-3 rounded-xl px-3 py-2 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span aria-hidden="true" className="bg-muted size-2 rounded-full" />
                      <span className="flex-1 font-medium">Pull requests</span>
                      <span className="text-muted tabular-nums">{prRefs.length}</span>
                    </a>
                  </li>
                )}
              </ul>
            </nav>
          )}

          <ReleaseContributors contributors={contributors} headingClassName={RAIL_HEADING} />

          <ReleaseTags tags={entry.tags} />
        </aside>
      </div>
    </article>
  );
};

export default ChangelogEntryDetail;
