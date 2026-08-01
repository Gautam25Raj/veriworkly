import Link from "next/link";
import Image from "next/image";
import { ExternalLink, GitCompareArrows, GitPullRequest } from "lucide-react";

import { Card } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";
import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";
import { categoriesFor, formatChangelogDate, TYPE_META } from "./changelog-utils";

const ChangelogEntryCard = ({
  entry,
  isLatest,
  previousVersion,
}: {
  entry: ChangelogEntry;
  isLatest: boolean;
  previousVersion?: string;
}) => {
  const categories = categoriesFor(entry);
  const typeMeta = TYPE_META[entry.type];
  const compareUrl = previousVersion
    ? `${siteConfig.links.github}/compare/Release-v${previousVersion}...Release-v${entry.version}`
    : null;

  return (
    <Card className="relative space-y-6 p-6 sm:p-8" id={entry.id}>
      {isLatest && (
        <span className="bg-accent text-accent-foreground absolute top-0 right-6 -translate-y-1/2 rounded-full px-3 py-1 font-mono text-[9px] font-bold tracking-widest uppercase shadow-sm">
          Latest
        </span>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-foreground font-mono text-lg font-bold tracking-tight">
              v{entry.version}
            </span>

            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase ${typeMeta.className}`}
            >
              {typeMeta.label}
            </span>

            <time
              dateTime={entry.publishedAt}
              className="text-muted font-mono text-[11px] tracking-wide"
            >
              {formatChangelogDate(entry.publishedAt)}
            </time>
          </div>

          <h2 className="text-foreground font-sans text-xl font-bold tracking-tight sm:text-2xl">
            {entry.title}
          </h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {compareUrl && (
            <Link
              href={compareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border/40 text-muted hover:text-foreground hover:border-border/60 hover:bg-muted/5 group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-sans text-xs font-semibold whitespace-nowrap transition-colors"
            >
              <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
              Compare changes
            </Link>
          )}

          {entry.githubUrl && (
            <Link
              href={entry.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border/40 text-muted hover:text-foreground hover:border-border/60 hover:bg-muted/5 group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-sans text-xs font-semibold whitespace-nowrap transition-colors"
            >
              View on GitHub
              <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
        </div>
      </div>

      {entry.summary && (
        <p className="text-muted max-w-3xl text-sm leading-relaxed sm:text-base">{entry.summary}</p>
      )}

      {categories.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {categories.map(({ category, items, label, icon: Icon, text, border }) => (
            <div key={category} className={`space-y-2.5 border-l-2 pl-4 ${border}`}>
              <div
                className={`flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest uppercase ${text}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </div>

              <ul className="space-y-1.5">
                {items.map((item, index) => (
                  <li key={index} className="text-muted text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
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

      {entry.prRefs && entry.prRefs.length > 0 && (
        <div className="border-border/30 space-y-1.5 border-t pt-4">
          <p className="text-muted/70 font-mono text-[9px] font-bold tracking-widest uppercase">
            Shipped in
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {entry.prRefs.map((pr) => (
              <li key={pr.number} className="text-muted flex items-center gap-1.5 text-xs">
                {pr.author ? (
                  <Image
                    src={pr.author.avatarUrl}
                    alt={pr.author.login}
                    title={pr.author.login}
                    width={16}
                    height={16}
                    className="ring-border/40 shrink-0 rounded-full ring-1"
                  />
                ) : (
                  <GitPullRequest className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}

                <Link
                  href={pr.url ?? `${siteConfig.links.github}/pull/${pr.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground flex min-w-0 items-center gap-1 transition-colors"
                >
                  <span className="font-mono">#{pr.number}</span>
                  <span className="truncate">{pr.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default ChangelogEntryCard;
