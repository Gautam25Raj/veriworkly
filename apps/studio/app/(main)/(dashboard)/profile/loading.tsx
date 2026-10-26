import {
  Bone,
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The account profile: identity card, account data beside usage stats, then the data layers. */
export default function ProfileLoading() {
  return (
    <SkeletonPage label="Loading profile">
      <TitleCardSkeleton side="18rem" sideRows={1} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <PanelSkeleton rows={4} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Bone key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>

        <PanelSkeleton rows={5} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Bone key={index} className="h-36 rounded-2xl" />
        ))}
      </section>
    </SkeletonPage>
  );
}
