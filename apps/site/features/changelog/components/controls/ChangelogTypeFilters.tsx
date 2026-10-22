import Link from "next/link";

import { cn } from "@veriworkly/ui";

import { buildChangelogHref } from "@/features/changelog/utils/changelog-utils";
import { type ChangelogType } from "@/features/changelog/services/changelog-backend";

const TYPES: Array<{ label: string; value: ChangelogType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
  { label: "Patch", value: "patch" },
];

const ChangelogTypeFilters = ({
  activeType,
  search,
  basePath = "/changelog",
}: {
  activeType: ChangelogType | "all";
  search?: string;
  basePath?: string;
}) => (
  <nav aria-label="Release type" className="bg-card flex w-fit gap-1 rounded-full p-1">
    {TYPES.map(({ label, value }) => {
      const isActive = activeType === value;

      return (
        <Link
          key={value}
          aria-current={isActive ? "page" : undefined}
          href={buildChangelogHref(basePath, {
            type: value === "all" ? undefined : value,
            search,
          })}
          className={cn(
            "focus-visible:ring-accent/40 rounded-full px-5 py-2.5 text-base font-semibold whitespace-nowrap transition-colors duration-200 select-none focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]",
            isActive ? "bg-foreground text-background" : "text-muted hover:text-foreground",
          )}
        >
          {label}
        </Link>
      );
    })}
  </nav>
);

export default ChangelogTypeFilters;
