import {
  PanelSkeleton,
  SkeletonPage,
  TitleCardSkeleton,
} from "@/components/dashboard/skeletons/PageSkeleton";

/** The create form beside its scope rail. */
export default function CreateApiKeyLoading() {
  return (
    <SkeletonPage label="Loading key form">
      <TitleCardSkeleton side="20rem" />

      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={6} />
      </section>
    </SkeletonPage>
  );
}
