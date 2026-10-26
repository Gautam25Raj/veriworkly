import { Bone, SkeletonPage } from "@/components/dashboard/skeletons/PageSkeleton";

/**
 * Shown while a route outside the dashboard (sign-in, editor, checkout) or the session check
 * in front of every studio page is loading. Neutral on purpose: it cannot know which page is
 * coming, so it promises a header and content, not a particular layout.
 */
const AppLoading = () => {
  return (
    <SkeletonPage label="Loading" className="bg-background min-h-dvh space-y-0">
      <div className="border-border/70 flex h-16 items-center justify-between border-b px-4 sm:px-6">
        <Bone className="h-9 w-36 rounded-xl" />
        <Bone className="h-9 w-24 rounded-xl" />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 xl:p-8">
        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <Bone className="h-4 w-24" />
          <Bone className="mt-3 h-9 w-72 max-w-full sm:h-10" />
          <Bone className="mt-2 h-5 w-full max-w-xl" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Bone key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
};

export default AppLoading;
