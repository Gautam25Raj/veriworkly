import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The program tabs, the heading and the three tier cards. */
export default function AffiliateTiersLoading() {
  return (
    <SkeletonPage label="Loading tiers" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} />

      <section className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <PanelSkeleton key={index} rows={4} />
        ))}
      </section>
    </SkeletonPage>
  );
}
