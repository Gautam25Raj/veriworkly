import { cn } from "@veriworkly/ui";

/**
 * Loading placeholders for the admin's server-rendered pages.
 *
 * Every admin page is a blocking server render against several aggregate queries, and until now
 * there was no `loading.tsx` anywhere under `/admin` — a slow overview left the operator on the
 * previous route with no feedback at all. These shapes mirror the real layout closely enough
 * that content does not jump when it arrives.
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-admin-inset animate-pulse rounded-md", className)}
      // Purely decorative: the `aria-busy`/`aria-live` announcement belongs on the region as a
      // whole, not on each individual grey box.
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <SkeletonBlock className="h-2.5 w-24" />
      <SkeletonBlock className="mt-3 h-6 w-20" />
      <SkeletonBlock className="mt-2 h-2.5 w-32" />
    </div>
  );
}

export function SkeletonPanel({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("border-border bg-card rounded-xl border", className)}>
      <div className="border-border border-b px-4 py-3">
        <SkeletonBlock className="h-3 w-32" />
      </div>

      <div className="space-y-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="bg-admin-inset border-border border-b px-4 py-2.5">
        <SkeletonBlock className="h-2.5 w-40" />
      </div>

      <div className="divide-border divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="hidden h-3 w-20 shrink-0 md:block" />
            <SkeletonBlock className="hidden h-3 w-16 shrink-0 md:block" />
            <SkeletonBlock className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Wraps a page's skeleton so assistive tech announces the load once, not per placeholder. */
export function SkeletonPage({
  children,
  label = "Loading",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-5">
      {children}
    </div>
  );
}

/** The default list-page skeleton: header, filter bar, table. Used by most admin routes. */
export function AdminListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonPage>
      <div>
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
      </div>

      <SkeletonBlock className="h-14 w-full rounded-xl" />

      <SkeletonTable rows={rows} />
    </SkeletonPage>
  );
}
