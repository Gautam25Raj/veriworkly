import { ScoreGauge } from "./ScoreGauge";
import { VerdictBadge } from "./VerdictBadge";
import type { AtsVerdict } from "../../types";

interface ScoreSummaryProps {
  verdict: AtsVerdict;
  readinessScore: number;
  jobMatchScore: number | null;
  checksPassed: number;
  checksTotal: number;
}

export function ScoreSummary({
  verdict,
  readinessScore,
  jobMatchScore,
  checksPassed,
  checksTotal,
}: ScoreSummaryProps) {
  return (
    <section aria-labelledby="ats-score-heading" className="bg-card rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4">
        <h2 id="ats-score-heading" className="sr-only">
          Your scores
        </h2>
        <VerdictBadge verdict={verdict} />
        <div className="flex w-full flex-wrap items-start justify-center gap-8 sm:gap-12">
          <ScoreGauge
            score={readinessScore}
            label="ATS readiness"
            caption="Parsing and formatting. Fixed by editing the layout, not the role."
          />
          {jobMatchScore !== null ? (
            <ScoreGauge
              score={jobMatchScore}
              label="Job match"
              size="sm"
              caption="Keyword coverage against the description you pasted."
            />
          ) : (
            <div className="bg-background flex max-w-56 flex-col items-center gap-2 self-center rounded-2xl px-5 py-6 text-center">
              <p className="text-base font-semibold">No job match yet</p>
              <p className="text-muted text-sm leading-6">
                Add a job description to score keyword coverage for a specific role.
              </p>
            </div>
          )}
        </div>
        <p className="text-muted text-base">
          <span className="text-foreground font-semibold tabular-nums">
            {checksPassed} of {checksTotal}
          </span>{" "}
          checks passed
        </p>
      </div>
    </section>
  );
}

export default ScoreSummary;
