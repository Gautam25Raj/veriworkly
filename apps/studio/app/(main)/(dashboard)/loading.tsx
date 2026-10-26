import {
  Bone,
  SkeletonPage,
  PreviewCardGridSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/**
 * The overview: greeting with counts, the help links (after the documents on phones), then
 * recent documents beside the shortcuts.
 */
export default function OverviewLoading() {
  return (
    <SkeletonPage label="Loading overview" className="flex flex-col gap-7 space-y-0">
      <header className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl">
            <Bone className="h-4 w-20" />
            <Bone className="mt-3 h-9 w-72 max-w-full sm:h-10" />
            <Bone className="mt-2 h-6 w-full max-w-xl" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Bone key={index} className="h-15 min-w-20 rounded-xl" />
            ))}
          </div>
        </div>
      </header>

      <div className="order-last grid gap-2 lg:order-none lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Bone key={index} className="h-16 rounded-2xl lg:h-40" />
        ))}
      </div>

      <div className="border-border bg-card grid overflow-hidden rounded-2xl border lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="border-border/70 border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
          <Bone className="h-6 w-40" />
          <Bone className="mt-2 h-4 w-60 max-w-full" />

          <PreviewCardGridSkeleton
            count={3}
            mediaClassName="h-32"
            className="mt-5 sm:grid-cols-2 xl:grid-cols-3"
          />
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <Bone className="h-5 w-36" />
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Bone key={index} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
