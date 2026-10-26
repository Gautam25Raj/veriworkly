import { Bone, SkeletonPage } from "@/components/dashboard/skeletons/PageSkeleton";

/** The document library: heading with the New button, the filter bar, then the card grid. */
export default function DocumentsLoading() {
  return (
    <SkeletonPage label="Loading documents" className="space-y-7">
      <header className="flex flex-col gap-3 pt-1">
        <Bone className="h-4 w-24" />

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-2xl">
            <Bone className="h-9 w-64 max-w-full sm:h-10" />
            <Bone className="mt-2 h-6 w-72 max-w-full" />
          </div>

          <div className="flex items-center gap-4">
            <Bone className="h-5 w-32" />
            <Bone className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </header>

      <section className="border-border bg-card rounded-2xl border">
        <div className="border-border/70 flex flex-col gap-4 border-b p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <Bone className="h-5 w-32" />

          <div className="flex flex-wrap items-center gap-3">
            <Bone className="h-10 w-36 rounded-xl" />
            <Bone className="h-10 w-36 rounded-xl" />
            <Bone className="h-10 w-32 rounded-xl" />
            <Bone className="h-10 w-20 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="border-border bg-card relative aspect-3/4 overflow-hidden rounded-xl border"
            >
              <Bone className="absolute inset-3 bottom-14 rounded-md" />
              <div className="border-border absolute inset-x-0 bottom-0 border-t p-3">
                <Bone className="h-5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  );
}
