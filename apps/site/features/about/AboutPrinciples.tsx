import { principles } from "./principlesData";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

const AboutPrinciples = () => (
  <PageSection
    tone="card"
    title="Four promises, kept in the code."
    lede="Every product decision here gets checked against these. When a feature would break one, the feature changes."
  >
    <dl className="grid gap-x-12 md:grid-cols-2">
      {principles.map((principle) => (
        <div key={principle.title} className="reveal border-border border-t py-8 lg:py-10">
          <dt className={`text-balance ${TYPE.title}`}>{principle.title}</dt>
          <dd className="text-muted mt-3 max-w-lg text-base leading-7 text-pretty">
            {principle.description}
          </dd>
        </div>
      ))}
    </dl>
  </PageSection>
);

export default AboutPrinciples;
