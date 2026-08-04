import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";

/**
 * A static, server-rendered rendition of the real report, shown on the landing page so the page
 * is not asking people to imagine what they get. Deliberately not the live component: it must
 * paint on the server with no API call, no client bundle, and no fabricated interactivity.
 *
 * The numbers are illustrative and labelled as such below the figure.
 */
const AREAS = [
  { label: "Parsing", score: 100, tone: "good" },
  { label: "Contact & links", score: 86, tone: "good" },
  { label: "Structure", score: 72, tone: "warn" },
  { label: "Evidence", score: 48, tone: "bad" },
  { label: "Format risk", score: 91, tone: "good" },
] as const;

const FILL = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
} as const;

const TEXT = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
} as const;

const FIXES = [
  { icon: XCircle, tone: "bad", text: "Only 2 of 14 bullets carry a number", points: 10 },
  { icon: TriangleAlert, tone: "warn", text: "No skills section an ATS can map", points: 6 },
  { icon: CheckCircle2, tone: "good", text: "Contact details sit in the top 30%", points: 0 },
] as const;

export function ReportPreview() {
  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_30px_90px_-50px_rgba(0,0,0,0.45)] dark:border-zinc-800 dark:bg-[#0c0c0c]">
        <div className="flex items-center gap-1.5 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800/80">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            ats-report
          </span>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ATS readiness</p>
              <p className="mt-1 flex items-baseline gap-1.5 text-4xl font-semibold tracking-tighter text-zinc-900 tabular-nums dark:text-white">
                74
                <span className="text-base font-medium text-zinc-500 dark:text-zinc-400">
                  / 100
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Job match</p>
              <p className="mt-1 flex items-baseline justify-end gap-1.5 text-4xl font-semibold tracking-tighter text-zinc-900 tabular-nums dark:text-white">
                61
                <span className="text-base font-medium text-zinc-500 dark:text-zinc-400">
                  / 100
                </span>
              </p>
            </div>
          </div>

          <span className="mt-4 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Needs work before you apply
          </span>

          <ul className="mt-6 space-y-3">
            {AREAS.map((area) => (
              <li key={area.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {area.label}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${TEXT[area.tone]}`}>
                    {area.score}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${FILL[area.tone]}`}
                    style={{ width: `${area.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <ul className="mt-6 space-y-2.5 border-t border-zinc-100 pt-5 dark:border-zinc-800/80">
            {FIXES.map((fix) => (
              <li key={fix.text} className="flex items-start gap-2.5">
                <fix.icon className={`mt-0.5 h-4 w-4 shrink-0 ${TEXT[fix.tone]}`} />
                <span className="flex-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                  {fix.text}
                </span>
                {fix.points ? (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 tabular-nums dark:bg-white/10 dark:text-zinc-200">
                    +{fix.points}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
        An example report. Your own numbers come from your resume text, not a template.
      </figcaption>
    </figure>
  );
}
