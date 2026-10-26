import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** Billing: the plan heading, the plan beside the credit balance, then billing activity. */
export default function BillingLoading() {
  return (
    <SkeletonPage label="Loading billing" className="space-y-5">
      <TitleCardSkeleton eyebrow={false} action />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={4} />
      </section>

      <PanelSkeleton rows={3} divided />
    </SkeletonPage>
  );
}
