import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The program tabs, the page heading and one list. */
export default function AffiliateReferralsLoading() {
  return (
    <SkeletonPage label="Loading referrals" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} />
      <PanelSkeleton rows={5} divided />
    </SkeletonPage>
  );
}
