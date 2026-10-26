import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The program tabs, the heading, the request form beside the payout history. */
export default function AffiliatePayoutsLoading() {
  return (
    <SkeletonPage label="Loading payouts" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} />

      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={5} divided />
      </section>
    </SkeletonPage>
  );
}
