import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { type ChangelogIndexItem } from "@/features/changelog/services/changelog-backend";
import { changelogEntryHref } from "./changelog-utils";

const cellClass =
  "border-border/40 bg-card/30 hover:border-border/60 hover:bg-card/50 flex flex-col gap-1.5 rounded-2xl border p-4 transition-colors";

/**
 * Chronological neighbours, not pagination: `newer` is the release that shipped after this one.
 */
const ChangelogEntryNav = ({
  older,
  newer,
}: {
  older: ChangelogIndexItem | null;
  newer: ChangelogIndexItem | null;
}) => {
  if (!older && !newer) return null;

  return (
    <nav aria-label="Adjacent releases" className="mt-12 grid gap-4 sm:grid-cols-2">
      {older ? (
        <Link href={changelogEntryHref(older.id)} className={cellClass}>
          <span className="text-muted flex items-center gap-1 font-mono text-[10px] font-bold tracking-widest uppercase">
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            Previous release
          </span>

          <span className="text-foreground font-mono text-sm font-bold">v{older.version}</span>
          <span className="text-muted truncate text-xs">{older.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      {newer && (
        <Link href={changelogEntryHref(newer.id)} className={`${cellClass} sm:text-right`}>
          <span className="text-muted flex items-center gap-1 font-mono text-[10px] font-bold tracking-widest uppercase sm:justify-end">
            Next release
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>

          <span className="text-foreground font-mono text-sm font-bold">v{newer.version}</span>
          <span className="text-muted truncate text-xs">{newer.title}</span>
        </Link>
      )}
    </nav>
  );
};

export default ChangelogEntryNav;
