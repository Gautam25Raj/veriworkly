import { categoryMeta, scoreTone, sortByCategoryOrder, TONE_CLASSES } from "../../data/categories";
import type { AtsCategoryScore } from "../../types";

export function CategoryBreakdown({ categories }: { categories: AtsCategoryScore[] }) {
  if (!categories.length) return null;

  return (
    <section aria-labelledby="ats-breakdown-heading" className="bg-card rounded-3xl p-6 sm:p-8">
      <h2 id="ats-breakdown-heading" className="text-xl font-bold tracking-tight">
        Where your readiness score went
      </h2>
      <p className="text-muted mt-1 text-base leading-7">
        Each area is scored on the share of its own weight your resume kept.
      </p>

      <ul className="mt-5 space-y-5">
        {sortByCategoryOrder(categories).map((entry) => {
          const meta = categoryMeta(entry.category);
          const tone = scoreTone(entry.score);
          return (
            <li key={entry.category}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <meta.icon className="text-muted h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-muted text-sm tabular-nums">
                    {entry.passed}/{entry.total} checks
                  </span>
                  <span
                    className={`text-base font-semibold tabular-nums ${TONE_CLASSES[tone].text}`}
                  >
                    {entry.score}%
                  </span>
                </span>
              </div>
              <div
                className="bg-foreground/8 mt-2 h-2 w-full overflow-hidden rounded-full"
                role="meter"
                aria-valuenow={entry.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${meta.label}: ${entry.score} percent, ${entry.passed} of ${entry.total} checks passed`}
              >
                <div
                  className={`h-full rounded-full ${TONE_CLASSES[tone].fill}`}
                  style={{ width: `${Math.max(entry.score, 2)}%` }}
                />
              </div>
              {meta.blurb ? (
                <p className="text-muted mt-2 text-sm leading-6">{meta.blurb}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CategoryBreakdown;
