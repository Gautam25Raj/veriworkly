import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { type Competitor } from "../../types";

interface CompareDeepDiveSectionProps {
  competitor: Competitor;
}

/** Each difference as one row: the topic, both approaches side by side, and what it means. */
export const CompareDeepDiveSection = ({ competitor }: CompareDeepDiveSectionProps) => {
  if (competitor.deepDive.length === 0) return null;

  return (
    <PageSection
      title="How they work differently."
      lede="Templates aside, these are the rules that decide how easily you can keep applying."
    >
      <ul>
        {competitor.deepDive.map((pillar) => (
          <li
            key={pillar.title}
            className="border-border reveal grid gap-6 border-t py-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-12"
          >
            <div>
              <h3 className={`${TYPE.title} text-balance`}>{pillar.title}</h3>
              <p className="text-muted mt-3 text-base leading-7 text-pretty">{pillar.takeaway}</p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="bg-card rounded-3xl p-6">
                <dt className="text-muted text-sm font-semibold">{competitor.name}</dt>
                <dd className="text-muted mt-3 text-base leading-7">{pillar.competitorApproach}</dd>
              </div>
              <div className="bg-accent/10 rounded-3xl p-6">
                <dt className="text-accent text-sm font-semibold">VeriWorkly</dt>
                <dd className="mt-3 text-base leading-7">{pillar.veriworklyApproach}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </PageSection>
  );
};

export default CompareDeepDiveSection;
