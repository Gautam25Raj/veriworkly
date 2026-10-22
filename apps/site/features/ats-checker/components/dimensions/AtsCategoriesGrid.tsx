import { CheckCircle2 } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { SCORING_DIMENSIONS } from "../../data/categories";

export function AtsCategoriesGrid() {
  return (
    <PageSection
      id="how-it-scores"
      title="Four areas, scored from your own text."
      lede="Every check runs against the text you provide. The rubric is public, so every rule and its weight can be read and checked."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {SCORING_DIMENSIONS.map((item) => (
          <article key={item.title} className="reveal bg-card flex flex-col rounded-3xl p-6 sm:p-8">
            <h3 className={TYPE.title}>{item.title}</h3>
            <p className="text-muted mt-3 mb-6 text-base leading-7 text-pretty">{item.body}</p>

            <ul className="border-border mt-auto space-y-2.5 border-t pt-5">
              {item.checks.map((check) => (
                <li key={check} className="flex items-center gap-3 text-base font-medium">
                  <CheckCircle2 aria-hidden="true" className="text-success size-4 shrink-0" />
                  {check}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </PageSection>
  );
}

export default AtsCategoriesGrid;
