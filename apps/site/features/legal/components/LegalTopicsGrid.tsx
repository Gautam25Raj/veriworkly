import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import type { LegalTopicsGridProps } from "../types";

/** The plain-language summary above a legal document. The document itself stays authoritative. */
export function LegalTopicsGrid({ title, lede, topics }: LegalTopicsGridProps) {
  return (
    <PageSection tone="card" title={title} lede={lede}>
      <dl className="grid gap-x-12 md:grid-cols-2">
        {topics.map((topic) => (
          <div key={topic.title} className="reveal border-border border-t py-8">
            <dt className={TYPE.title}>{topic.title}</dt>
            <dd className="text-muted mt-3 max-w-lg text-base leading-7 text-pretty">
              {topic.description}
            </dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}
