import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The program tabs, the page heading and one list. */
export default function AffiliateCommissionsLoading() {
  return (
    <SkeletonPage label="Loading commissions" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} />
      <PanelSkeleton rows={5} divided />
    </SkeletonPage>
  );
}
