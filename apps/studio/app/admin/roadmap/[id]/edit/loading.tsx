import { SkeletonBlock, SkeletonPage } from "@/components/admin/AdminSkeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading form">
      <div>
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
      </div>

      <SkeletonBlock className="h-[32rem] w-full rounded-xl" />
    </SkeletonPage>
  );
}
