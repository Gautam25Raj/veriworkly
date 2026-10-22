import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { type Competitor } from "../../types";

interface CompareHighlightsProps {
  competitor: Competitor;
}

export const CompareHighlights = ({ competitor }: CompareHighlightsProps) => {
  const notes = [
    { title: `What ${competitor.name} does well`, body: competitor.standoutFeature },
    { title: "Good to know", body: competitor.knownLimitation },
    { title: "Why people switch", body: competitor.whySwitch },
  ];

  return (
    <PageSection
      tone="card"
      title="Where each one wins."
      lede={`${competitor.name} is a good tool. Here is what it does well, where it limits you, and who should pick which.`}
    >
      <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <dl>
          {notes.map((note) => (
            <div
              key={note.title}
              className="border-border reveal border-t py-6 first:border-t-0 first:pt-0"
            >
              <dt className={TYPE.title}>{note.title}</dt>
              <dd className="text-muted mt-2 max-w-xl text-base leading-7 text-pretty">
                {note.body}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid content-start gap-4">
          <div data-ui className="bg-background reveal rounded-3xl p-7 lg:p-8">
            <h3 className={TYPE.title}>Choose {competitor.name} if</h3>
            <p className="text-muted mt-3 text-base leading-7 text-pretty">
              {competitor.bestForCompetitor}
            </p>
          </div>
          <div data-ui className="bg-foreground text-background reveal rounded-3xl p-7 lg:p-8">
            <h3 className={TYPE.title}>Choose VeriWorkly if</h3>
            <p className="mt-3 text-base leading-7 text-pretty opacity-80">
              {competitor.bestForVeriworkly}
            </p>
          </div>
        </div>
      </div>
    </PageSection>
  );
};

export default CompareHighlights;
