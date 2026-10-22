import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { buildChangelogHref } from "@/features/changelog/utils/changelog-utils";
import { type ChangelogPagination as ChangelogPaginationMeta } from "@/features/changelog/services/changelog-backend";

interface ChangelogPaginationProps {
  pagination: ChangelogPaginationMeta;
  activeType?: string;
  search?: string;
  basePath?: string;
}

const navLinkClass = (disabled: boolean) =>
  cn(
    "bg-card inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold whitespace-nowrap transition-colors duration-200",
    disabled
      ? "text-muted pointer-events-none opacity-50"
      : "hover:bg-foreground hover:text-background focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]",
  );

const ChangelogPagination = ({
  pagination,
  activeType,
  search,
  basePath = "/changelog",
}: ChangelogPaginationProps) => {
  const { page, totalPages } = pagination;

  if (totalPages <= 1) return null;

  const hrefForPage = (targetPage: number) =>
    buildChangelogHref(basePath, {
      type: activeType && activeType !== "all" ? activeType : undefined,
      search,
      page: targetPage > 1 ? targetPage.toString() : undefined,
    });

  const previous = (
    <>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Newer
    </>
  );
  const next = (
    <>
      Older
      <ArrowRight className="size-4" aria-hidden="true" />
    </>
  );

  return (
    <nav
      aria-label="Changelog pagination"
      className="mt-12 flex items-center justify-between gap-4"
    >
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={navLinkClass(false)}>
          {previous}
        </Link>
      ) : (
        <span className={navLinkClass(true)}>{previous}</span>
      )}

      <p className="text-muted text-base tabular-nums">
        Page {page} of {totalPages}
      </p>

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={navLinkClass(false)}>
          {next}
        </Link>
      ) : (
        <span className={navLinkClass(true)}>{next}</span>
      )}
    </nav>
  );
};

export default ChangelogPagination;
