import { Bone, SkeletonPage } from "@/components/dashboard/skeletons/PageSkeleton";

/** The ATS workspace: heading with the allowance, the three steps, and the report panel. */
export default function AtsLoading() {
  return (
    <SkeletonPage
      label="Loading ATS checker"
      className="mx-auto w-full max-w-7xl space-y-0 px-4 py-6 sm:px-8 sm:py-10"
    >
      <header className="border-border mb-8 flex flex-col gap-5 border-b pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-3xl">
          <Bone className="mb-3 h-5 w-36" />
          <Bone className="h-9 w-full max-w-2xl sm:h-10" />
          <Bone className="mt-3 h-5 w-full max-w-xl" />
        </div>

        <div className="flex gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <Bone key={index} className="h-10 w-20" />
          ))}
        </div>
      </header>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <div className="space-y-6">
          {["h-80", "h-64", "h-72"].map((height) => (
            <div
              key={height}
              className={`bg-card ring-border rounded-xl p-5 ring-1 sm:p-6 ${height}`}
            >
              <Bone className="h-7 w-64 max-w-full" />
            </div>
          ))}
        </div>

        <Bone className="hidden min-h-112 rounded-xl xl:block" />
      </section>
    </SkeletonPage>
  );
}
