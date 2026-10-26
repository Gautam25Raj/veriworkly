import { SkeletonPage, TitleCardSkeleton } from "@/components/dashboard/skeletons/PageSkeleton";
import AdvancedSkeleton from "@/features/profile/components/advanced/AdvanceProfileSkeleton";

/** The JSON tools page, ending in the same placeholder its panels show while they load. */
export default function AdvancedProfileLoading() {
  return (
    <SkeletonPage label="Loading profile JSON tools">
      <TitleCardSkeleton side="20rem" />
      <AdvancedSkeleton />
    </SkeletonPage>
  );
}
