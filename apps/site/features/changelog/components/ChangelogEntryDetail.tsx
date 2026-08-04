import Link from "next/link";
import Image from "next/image";
import { ExternalLink, GitCompareArrows, GitPullRequest } from "lucide-react";

import { siteConfig } from "@/config/site";
import {
  type ChangelogEntry,
  type ChangelogIndexItem,
} from "@/features/changelog/services/changelog-backend";

import { categoriesFor, formatChangelogDate, TYPE_META } from "./changelog-utils";

const linkClass =
  "border-border/40 text-muted hover:text-foreground hover:border-border/60 hover:bg-muted/5 group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-sans text-xs font-semibold whitespace-nowrap transition-colors";

const ChangelogEntryDetail = ({
  entry,
  older,
  isLatest,
}: {
  entry: ChangelogEntry;
  older: ChangelogIndexItem | null;
  isLatest: boolean;
}) => {
  const categories = categoriesFor(entry);
  const typeMeta = TYPE_META[entry.type];
  const prRefs = entry.prRefs ?? [];

  const compareUrl = older
    ? `${siteConfig.links.github}/compare/Release-v${older.version}...Release-v${entry.version}`
    : null;

  return (
    <article className="space-y-10">
      <header className="border-border/40 space-y-5 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-foreground font-mono text-2xl font-bold tracking-tight">
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
            className="text-muted font-mono text-[11px] tracking-wide"
          >
            {formatChangelogDate(entry.publishedAt)}
          </time>
        </div>

        <h1 className="text-foreground font-sans text-3xl font-bold tracking-tight sm:text-4xl">
          {entry.title}
        </h1>

        {entry.summary && (
          <p className="text-muted max-w-3xl text-base leading-relaxed">{entry.summary}</p>
        )}

        {(compareUrl || entry.githubUrl) && (
          <div className="flex flex-wrap items-center gap-2">
            {compareUrl && (
              <Link
                href={compareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                Compare with v{older?.version}
              </Link>
            )}

            {entry.githubUrl && (
              <Link
                href={entry.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                View on GitHub
                <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            )}
          </div>
        )}
      </header>

      {categories.length > 0 ? (
        <div className="space-y-8">
          {categories.map(({ category, items, label, icon: Icon, text, border }) => (
            <section key={category} className={`space-y-3 border-l-2 pl-5 ${border}`}>
              <h2
                className={`flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-widest uppercase ${text}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
                <span className="text-muted/70">({items.length})</span>
              </h2>

              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li key={index} className="text-muted text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm leading-relaxed">
          No itemised changes were recorded for this release. The linked GitHub release and pull
          requests carry the full detail.
        </p>
      )}

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="bg-muted/10 text-muted border-border/30 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {prRefs.length > 0 && (
        <section className="border-border/30 space-y-3 border-t pt-6">
          <h2 className="text-muted/70 font-mono text-[10px] font-bold tracking-widest uppercase">
            Shipped in {prRefs.length} pull request{prRefs.length === 1 ? "" : "s"}
          </h2>

          <ul className="space-y-2">
            {prRefs.map((pr) => (
              <li key={pr.number} className="text-muted flex items-center gap-2 text-sm">
                {pr.author ? (
                  <Image
                    src={pr.author.avatarUrl}
                    alt={pr.author.login}
                    title={pr.author.login}
                    width={18}
                    height={18}
                    className="ring-border/40 shrink-0 rounded-full ring-1"
                  />
                ) : (
                  <GitPullRequest className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}

                <Link
                  href={pr.url ?? `${siteConfig.links.github}/pull/${pr.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground flex min-w-0 items-center gap-2 transition-colors"
                >
                  <span className="font-mono text-xs">#{pr.number}</span>
                  <span className="truncate">{pr.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};

export default ChangelogEntryDetail;
