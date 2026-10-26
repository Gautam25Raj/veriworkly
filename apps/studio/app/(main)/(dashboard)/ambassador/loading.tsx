import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The ambassador status card, where the application stands, then the toolkit. */
export default function AmbassadorLoading() {
  return (
    <SkeletonPage label="Loading ambassador program" className="space-y-5">
      <TitleCardSkeleton eyebrow={false} action />
      <PanelSkeleton rows={3} className="sm:p-6" />
      <PanelSkeleton rows={4} className="sm:p-6" />
    </SkeletonPage>
  );
}
