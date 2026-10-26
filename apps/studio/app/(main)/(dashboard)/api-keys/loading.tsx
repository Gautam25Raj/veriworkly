import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The key list: title card with the two key counts, then the list of keys. */
export default function ApiKeysLoading() {
  return (
    <SkeletonPage label="Loading API keys">
      <TitleCardSkeleton side="24rem" sideColumns={2} />
      <PanelSkeleton rows={4} divided className="sm:p-6" />
    </SkeletonPage>
  );
}
