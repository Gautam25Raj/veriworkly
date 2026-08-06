import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
  SkeletonPanel,
} from "@/components/admin/AdminSkeleton";

/**
 * Mirrors the dashboard's real grid — queue strip, four KPIs, the growth chart beside the role
 * breakdown — so nothing shifts position when the data lands. The dashboard fans out to three
 * admin endpoints, one of which runs every domain summary aggregate, so this is the skeleton
 * most likely to actually be seen.
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading dashboard">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SkeletonBlock className="h-6 w-36" />
          <SkeletonBlock className="mt-2 h-3 w-72 max-w-full" />
        </div>

        <SkeletonBlock className="h-8 w-40 rounded-lg" />
      </div>

      <SkeletonBlock className="h-14 w-full rounded-xl" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="border-border bg-card rounded-xl border lg:col-span-2">
          <div className="border-border border-b px-4 py-3">
            <SkeletonBlock className="h-3 w-24" />
          </div>

          <div className="p-4">
            <SkeletonBlock className="h-[220px] w-full rounded-lg" />
          </div>
        </div>

        <SkeletonPanel rows={5} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SkeletonPanel rows={5} />
        <SkeletonPanel rows={5} />
        <SkeletonPanel rows={5} />
      </div>
    </SkeletonPage>
  );
}
