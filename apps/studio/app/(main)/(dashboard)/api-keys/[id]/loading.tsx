import {
  Bone,
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** One key: its header, the overview and actions, and the scopes beside them. */
export default function ApiKeyDetailLoading() {
  return (
    <SkeletonPage label="Loading API key">
      <TitleCardSkeleton side="22rem" />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Bone key={index} className="h-24 rounded-2xl" />
            ))}
          </div>

          <PanelSkeleton rows={1} />
        </div>

        <PanelSkeleton rows={6} />
      </section>
    </SkeletonPage>
  );
}
