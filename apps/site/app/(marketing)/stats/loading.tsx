import { FRAME, PageHero } from "@/components/marketing/PageLayout";

/** The real headline renders at once; only the figures and rows wait for the sync. */
const StatsLoading = () => (
  <>
    <p className="sr-only" role="status" aria-live="polite">
      Loading development statistics
    </p>

    <PageHero
      title="Development,"
      highlight="in the open."
      lede="Every public issue and pull request on the VeriWorkly GitHub board, synced on our server and filtered here without hiding anything."
      aside={<div className="bg-card h-12 w-64 animate-pulse rounded-full" />}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border-border border-t pt-5">
            <div className="bg-card h-12 w-24 animate-pulse rounded-xl" />
            <div className="bg-card mt-4 h-4 w-32 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </PageHero>

    <div aria-hidden="true" className="py-16 lg:py-24">
      <div className={`${FRAME} space-y-3`}>
        <div className="bg-card mb-10 h-14 w-full max-w-md animate-pulse rounded-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card h-24 animate-pulse rounded-3xl" />
        ))}
      </div>
    </div>
  </>
);

export default StatsLoading;
