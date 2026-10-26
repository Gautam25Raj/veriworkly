import { SkeletonPage, TitleCardSkeleton } from "@/components/dashboard/skeletons/PageSkeleton";
import { MasterSkeleton } from "@/features/profile/components/master/MasterProfileLoading";

/** The Master Profile page, ending in the same placeholder its editor shows while it loads. */
export default function MasterProfileLoading() {
  return (
    <SkeletonPage label="Loading Master Profile">
      <TitleCardSkeleton side="20rem" />
      <MasterSkeleton />
    </SkeletonPage>
  );
}
