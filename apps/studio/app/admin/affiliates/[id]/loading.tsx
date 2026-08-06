import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
  SkeletonPanel,
} from "@/components/admin/AdminSkeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div>
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonPanel rows={6} />
        <SkeletonPanel rows={6} />
      </div>
    </SkeletonPage>
  );
}
