import { CheckCircle2, CircleDashed, CircleHelp, XCircle } from "lucide-react";

import type { AtsRequirement } from "../../types";

const STATUS: Record<
  AtsRequirement["status"],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  met: { label: "Met", icon: CheckCircle2, className: "text-success" },
  partial: {
    label: "Partly met",
    icon: CircleDashed,
    className: "text-warning",
  },
  missing: { label: "Not shown", icon: XCircle, className: "text-destructive" },
  unverifiable: {
    label: "Answer in the application",
    icon: CircleHelp,
    className: "text-muted",
  },
};

/**
 * The posting's requirements one by one, the way a per-qualification screener reads them: each
 * met or not, with the resume's own lines as evidence. Required ones lead; within each, the gaps
 * come first, because they are what to act on.
 */
export function RequirementsPanel({ requirements }: { requirements: AtsRequirement[] }) {
  if (!requirements.length) return null;

  const order = { missing: 0, partial: 1, unverifiable: 2, met: 3 } as const;
  const sorted = [...requirements].sort(
    (a, b) =>
      Number(a.importance === "preferred") - Number(b.importance === "preferred") ||
      order[a.status] - order[b.status],
  );
  const met = requirements.filter((r) => r.status === "met").length;

  return (
    <section aria-labelledby="ats-requirements-heading" className="bg-card rounded-3xl p-6 sm:p-8">
      <h2 id="ats-requirements-heading" className="text-xl font-bold tracking-tight">
        Requirement by requirement
      </h2>
      <p className="text-muted mt-1 text-base leading-7">
        {met} of {requirements.length} shown by the resume. Screeners now grade each requirement on
        its own, so a gap here costs more than a missing keyword.
      </p>
      <ul className="mt-5 space-y-4">
        {sorted.map((requirement) => {
          const status = STATUS[requirement.status];
          return (
            <li
              key={`${requirement.importance}:${requirement.text}`}
              className="border-border flex items-start gap-3 border-t pt-4 first:border-t-0 first:pt-0"
            >
              <status.icon
                className={`mt-1 h-4 w-4 shrink-0 ${status.className}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base leading-7 font-medium">{requirement.text}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className={`font-semibold ${status.className}`}>{status.label}</span>
                  {requirement.importance === "preferred" ? (
                    <span className="text-muted">Nice to have</span>
                  ) : null}
                  {requirement.detail ? (
                    <span className="text-muted">{requirement.detail}</span>
                  ) : null}
                </div>
                {requirement.evidence.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {requirement.evidence.map((line) => (
                      <li
                        key={line}
                        className="bg-background text-muted rounded-xl px-3 py-2 text-sm leading-6"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
