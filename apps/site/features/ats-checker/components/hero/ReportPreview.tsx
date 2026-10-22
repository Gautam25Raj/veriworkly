import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";

/**
 * A static, server-rendered rendition of the real report, shown on the landing page so the page
 * is not asking people to imagine what they get. Deliberately not the live component: it must
 * paint on the server with no API call, no client bundle, and no fabricated interactivity.
 *
 * The numbers are illustrative and labelled as such below the figure.
 */
/**
 * Labels must match `categoryMeta` in ../../data/categories.ts exactly - this preview
 * promises the report's own vocabulary, and previously used four labels the real
 * report never renders ("Parsing & extraction", "Document structure", "Evidence &
 * impact", "Format risk profile").
 */
const AREAS = [
  { label: "Parsing", score: 100, tone: "good" },
  { label: "Contact & links", score: 86, tone: "good" },
  { label: "Structure", score: 72, tone: "warn" },
  { label: "Evidence", score: 48, tone: "bad" },
  { label: "Format risk", score: 91, tone: "good" },
] as const;

const FILL = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
} as const;

const ICON = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
} as const;

const FIXES = [
  { icon: XCircle, tone: "bad", text: "Only 2 of 14 bullets carry measurable numbers", points: 10 },
  {
    icon: TriangleAlert,
    tone: "warn",
    text: "Missing recognized skills header section",
    points: 6,
  },
  {
    icon: CheckCircle2,
    tone: "good",
    text: "Contact details sit in the first quarter of the document",
    points: 0,
  },
] as const;

const SCORES = [
  { label: "ATS readiness", value: 74 },
  { label: "Job match", value: 61 },
] as const;

const CHECKS = { passed: 12, total: 16 };

export function ReportPreview() {
  return (
    <figure className="w-full">
      <div data-ui className="bg-card grid overflow-hidden rounded-3xl lg:grid-cols-[.9fr_1.1fr]">
        <div className="bg-foreground text-background flex flex-col p-6 sm:p-8 lg:p-10">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm font-semibold opacity-70">
            <span>Sample report</span>
            <span className="font-medium">gautam-raj-resume.pdf</span>
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-6">
            {SCORES.map((score) => (
              <div key={score.label}>
                <dt className="text-sm font-medium opacity-70">{score.label}</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-5xl leading-none font-bold tracking-tighter tabular-nums lg:text-6xl">
                    {score.value}
                  </span>
                  <span className="text-base font-medium opacity-60">/ 100</span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-current/10 px-4 py-2 text-sm font-semibold">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Needs work before you apply
          </p>

          <div className="mt-8">
            <p className="text-sm font-medium opacity-70">
              {CHECKS.passed} of {CHECKS.total} checks passed
            </p>
            <div aria-hidden="true" className="mt-3 flex gap-1">
              {Array.from({ length: CHECKS.total }, (_, index) => (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded-full ${index < CHECKS.passed ? "bg-success" : "bg-current/15"}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-current/[0.07] p-5 lg:mt-auto">
            <p className="text-sm font-medium opacity-70">Highest-impact fix</p>
            <p className="mt-2 text-lg leading-snug font-semibold">
              Put a number on more of your bullets: a percentage, a count, a time saved.
            </p>
            <p className="mt-1 text-sm opacity-70">Worth about 10 points.</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-base font-semibold">Score by area</p>

          <ul className="mt-5 space-y-4">
            {AREAS.map((area) => (
              <li key={area.label}>
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <span>{area.label}</span>
                  <span className="font-semibold tabular-nums">{area.score}%</span>
                </div>
                <div className="bg-foreground/8 mt-2 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${FILL[area.tone]}`}
                    style={{ width: `${area.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-base font-semibold">Fixes, by points recovered</p>

          <ul className="mt-4 space-y-3">
            {FIXES.map((fix) => (
              <li key={fix.text} className="flex items-start justify-between gap-4 text-base">
                <span className="flex min-w-0 items-start gap-2.5">
                  <fix.icon
                    aria-hidden="true"
                    className={`mt-1 size-4 shrink-0 ${ICON[fix.tone]}`}
                  />
                  <span className="text-muted">{fix.text}</span>
                </span>
                {fix.points ? (
                  <span className="bg-background shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                    +{fix.points} pts
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <figcaption className="text-muted mt-4 text-sm">
        Sample output. Your own score is computed from your resume text, in memory, and nothing is
        kept.
      </figcaption>
    </figure>
  );
}

export default ReportPreview;
