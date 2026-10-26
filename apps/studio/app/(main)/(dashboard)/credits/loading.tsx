import {
  Bone,
  PanelSkeleton,
  SkeletonPage,
  StatGridSkeleton,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** Credit usage: heading, three balances, what actions cost, then recent activity. */
export default function CreditsLoading() {
  return (
    <SkeletonPage label="Loading credit usage" className="space-y-5">
      <TitleCardSkeleton action />
      <StatGridSkeleton count={3} className="sm:grid-cols-3" />

      <section className="border-border bg-card rounded-2xl border p-5">
        <Bone className="h-5 w-40" />
        <Bone className="mt-3 h-4 w-full max-w-3xl" />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Bone key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>

      <PanelSkeleton rows={4} divided />
    </SkeletonPage>
  );
}
