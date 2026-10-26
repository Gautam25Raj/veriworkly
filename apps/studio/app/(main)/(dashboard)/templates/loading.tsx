import {
  Bone,
  PreviewCardGridSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The template gallery: heading, the document-type tabs, then preview cards. */
export default function TemplatesLoading() {
  return (
    <SkeletonPage label="Loading templates">
      <TitleCardSkeleton />

      <div className="space-y-5">
        <Bone className="h-11 w-72 max-w-full rounded-xl" />
        <PreviewCardGridSkeleton
          count={3}
          mediaClassName="h-64"
          className="gap-4 sm:grid-cols-2 xl:grid-cols-3"
        />
      </div>
    </SkeletonPage>
  );
}
