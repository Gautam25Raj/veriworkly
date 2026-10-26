import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  StatGridSkeleton,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** Affiliate overview: the program tabs stay usable while the numbers load. */
export default function AffiliateLoading() {
  return (
    <SkeletonPage label="Loading affiliate overview" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} action />
      <StatGridSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
      </section>
    </SkeletonPage>
  );
}
