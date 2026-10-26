import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The program tabs, the heading, and the monthly and all-time boards side by side. */
export default function AffiliateLeaderboardLoading() {
  return (
    <SkeletonPage label="Loading leaderboard" className="space-y-5">
      <AffiliateNav />
      <TitleCardSkeleton eyebrow={false} />

      <section className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={5} divided />
        <PanelSkeleton rows={5} divided />
      </section>
    </SkeletonPage>
  );
}
