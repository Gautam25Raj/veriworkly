import type { ReactNode } from "react";

import { cn } from "@veriworkly/ui";

/**
 * Loading placeholders for studio pages. Each route's `loading.tsx` composes these into the
 * shape of its own page, using the same card classes and spacing, so content replaces the
 * skeleton in place instead of pushing the layout around.
 */

/** One placeholder bar. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("bg-border animate-pulse rounded-lg", className)} />;
}

/** Announces the loading state once per page; the bones themselves are hidden from readers. */
export function SkeletonPage({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-6", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Literal class names so Tailwind generates them; the widths are the side panels pages use.
const SIDE_COLUMNS = {
  "18rem": "lg:grid-cols-[minmax(0,1fr)_18rem]",
  "20rem": "lg:grid-cols-[minmax(0,1fr)_20rem]",
  "21rem": "lg:grid-cols-[minmax(0,1fr)_21rem]",
  "22rem": "lg:grid-cols-[minmax(0,1fr)_22rem]",
  "24rem": "lg:grid-cols-[minmax(0,1fr)_24rem]",
} as const;

/**
 * The title card most pages open with: an eyebrow, the heading and a line of text, then
 * either a side panel (`side`, with `sideRows` rows) or an action button on the right.
 */
export function TitleCardSkeleton({
  eyebrow = true,
  action = false,
  side,
  sideRows = 2,
  sideColumns = 1,
}: {
  eyebrow?: boolean;
  action?: boolean;
  side?: keyof typeof SIDE_COLUMNS;
  sideRows?: number;
  sideColumns?: 1 | 2;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card grid overflow-hidden rounded-2xl border",
        side && SIDE_COLUMNS[side],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
        <div className="w-full max-w-2xl">
          {eyebrow ? <Bone className="mb-3 h-4 w-24" /> : null}
          <Bone className="h-9 w-64 max-w-full sm:h-10" />
          <Bone className="mt-3 h-5 w-full max-w-xl" />
        </div>

        {action ? <Bone className="h-10 w-36 rounded-lg" /> : null}
      </div>

      {side ? (
        <div
          className={cn(
            "border-border/70 grid gap-3 border-t p-5 lg:border-t-0 lg:border-l",
            sideColumns === 2 && "sm:grid-cols-2",
          )}
        >
          {Array.from({ length: sideRows }, (_, index) => (
            <Bone
              key={index}
              className={sideColumns === 2 ? "h-20 rounded-xl" : "h-11 rounded-xl"}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** A card with a heading and `rows` lines, divided like the history and key lists. */
export function PanelSkeleton({
  rows = 3,
  divided = false,
  className,
}: {
  rows?: number;
  divided?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("border-border bg-card rounded-2xl border p-5", className)}>
      <Bone className="h-5 w-40" />

      <div
        className={cn(
          "mt-4",
          divided ? "border-border divide-border divide-y border-y" : "space-y-3",
        )}
      >
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={cn("flex items-center justify-between gap-4", divided && "py-3")}
          >
            <Bone className="h-4 w-2/5" />
            <Bone className="h-4 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A row of small metric cards: icon, label, number. */
export function StatGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <section className={cn("grid gap-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="border-border bg-card rounded-2xl border p-5">
          <Bone className="h-4 w-4 rounded" />
          <Bone className="mt-4 h-3 w-20" />
          <Bone className="mt-2 h-8 w-16" />
        </article>
      ))}
    </section>
  );
}

/** Cards that lead with a preview image, as the document library and template gallery show. */
export function PreviewCardGridSkeleton({
  count,
  mediaClassName = "h-40",
  className,
}: {
  count: number;
  mediaClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="border-border bg-background/70 overflow-hidden rounded-xl border"
        >
          <div className={cn("border-border/70 border-b p-2", mediaClassName)}>
            <Bone className="h-full w-full rounded-md" />
          </div>
          <div className="space-y-2 p-3">
            <Bone className="h-4 w-3/4" />
            <Bone className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
