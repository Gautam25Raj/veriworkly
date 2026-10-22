import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { FAILURE_TRAPS } from "../../data/failureTraps";

export function AtsFailureTraps() {
  return (
    <PageSection
      title="Four ways a good resume goes missing."
      lede="An ATS indexes your resume rather than judging it. These four failures leave the indexed fields empty or wrong, which keeps a qualified application out of a recruiter's search."
    >
      <ul className="grid gap-6 md:grid-cols-2">
        {FAILURE_TRAPS.map((trap) => (
          <li key={trap.title} className="reveal bg-card flex flex-col rounded-3xl p-6 lg:p-8">
            <h3 className={`text-balance ${TYPE.title}`}>{trap.title}</h3>
            <p className="text-muted mt-3 mb-6 text-base leading-7 text-pretty">{trap.problem}</p>

            <div className="bg-background mt-auto rounded-2xl p-4 sm:p-5">
              <p className="text-accent text-sm font-semibold">How the checker catches it</p>
              <p className="mt-2 text-base leading-7 text-pretty">{trap.solution}</p>
            </div>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

export default AtsFailureTraps;
