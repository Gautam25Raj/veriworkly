"use client";

import { TYPE } from "@/components/marketing/PageLayout";

const EmptyState = ({ onReset }: { onReset: () => void }) => (
  <div className="bg-card rounded-3xl px-6 py-16 text-center sm:px-10">
    <p className={TYPE.title}>No templates match.</p>
    <p className="text-muted mx-auto mt-3 max-w-sm text-base">
      Try a different word, or another style or layout.
    </p>

    {/* Resets in place - the filters are client state, so there is nothing to navigate to. */}
    <button
      type="button"
      onClick={onReset}
      className="bg-foreground text-background focus-visible:ring-accent/40 mt-8 inline-flex h-12 cursor-pointer items-center rounded-full px-6 text-base font-semibold transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
    >
      Show every template
    </button>
  </div>
);

export default EmptyState;
