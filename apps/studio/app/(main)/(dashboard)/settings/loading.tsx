import {
  Bone,
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** Settings: title card, the section menu, then the appearance and sync panels. */
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading settings">
      <TitleCardSkeleton side="21rem" sideRows={1} />

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="border-border bg-card space-y-1 self-start rounded-2xl border p-2">
          <Bone className="h-9" />
          <Bone className="h-9" />
        </div>

        <div className="space-y-5">
          <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
            <Bone className="h-10 w-60" />
            <Bone className="mt-6 h-6 w-44" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Bone key={index} className="h-36 rounded-2xl" />
              ))}
            </div>
          </section>

          <PanelSkeleton rows={6} className="sm:p-6" />
          <Bone className="h-24 rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
