"use client";

import { useId, useState } from "react";

const MIN = 16;
const MAX = 52;

/** The range is the studio's own (16px to 52px); the preview is half size, so the margin shown is half too. */
const MarginPreview = () => {
  const [margin, setMargin] = useState(24);
  const inputId = useId();

  return (
    <div data-ui className="bg-foreground text-background rounded-3xl p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={inputId} className="text-base font-semibold">
          Page margins
        </label>
        <output htmlFor={inputId} className="text-2xl font-bold tracking-tight tabular-nums">
          {margin}px
        </output>
      </div>

      <input
        id={inputId}
        type="range"
        min={MIN}
        max={MAX}
        step={4}
        value={margin}
        onChange={(event) => setMargin(Number(event.target.value))}
        aria-valuetext={`${margin} pixel margins`}
        className="accent-accent mt-4 h-11 w-full cursor-pointer"
      />

      <div
        className="bg-accent/25 mt-4 rounded-xl transition-[padding] duration-200 ease-out"
        style={{ padding: margin / 2 }}
      >
        <div className="bg-card text-foreground rounded-sm p-4 sm:p-5">
          <p className="text-lg font-bold tracking-tight">Gautam Raj</p>
          <p className="text-muted text-sm">Product designer, Bengaluru</p>

          <p className="mt-4 text-sm font-semibold">Lumen Health, 2022 to now</p>
          <p className="text-muted mt-1 text-sm leading-6">
            Redesigned patient onboarding, cutting completion time by 38%.
          </p>

          <p className="mt-3 text-sm font-semibold">Skills</p>
          <p className="text-muted mt-1 text-sm leading-6">Figma, research, design systems</p>
        </div>
      </div>

      <p className="mt-4 text-sm opacity-70">Sample resume. Drag to try the studio&apos;s range.</p>
    </div>
  );
};

export default MarginPreview;
