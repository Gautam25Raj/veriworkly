import { Plus } from "lucide-react";

import { PageSection } from "@/components/marketing/PageLayout";
import type { FaqItem } from "@/features/faq/data/faqItems";

interface AtsCheckerFaqProps {
  faqs: FaqItem[];
}

/** Native disclosure widgets: every answer stays in the server HTML for crawlers and no-script visitors. */
export function AtsCheckerFaq({ faqs }: AtsCheckerFaqProps) {
  return (
    <PageSection
      tone="card"
      title="Questions about ATS checking."
      lede="How parsing works, how the two scores are calculated, what the limits are, and what happens to your file."
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_.45fr]">
        <div>
          {faqs.map((faq, index) => (
            <details
              key={faq.id}
              open={index === 0}
              className="reveal group border-border border-t last:border-b"
            >
              <summary className="focus-visible:ring-accent/40 flex cursor-pointer list-none items-start justify-between gap-6 rounded-xl py-5 text-lg font-semibold tracking-tight text-balance focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <Plus
                  aria-hidden="true"
                  className="text-muted mt-1 size-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="text-muted max-w-2xl pb-6 text-base leading-7 text-pretty">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h3 className="text-base font-semibold">What the score is not</h3>
          <p className="text-muted mt-3 text-sm leading-6">
            The VeriWorkly ATS Checker evaluates documents against heuristic parsing standards,
            weighted keyword matching, and structural guidelines. It does not simulate or guarantee
            compatibility with any specific proprietary employer software, nor does it guarantee
            interviews or job offers. All third-party product and company names mentioned are
            trademarks or registered trademarks of their respective owners. Their mention does not
            imply endorsement, affiliation, or sponsorship.
          </p>
        </aside>
      </div>
    </PageSection>
  );
}

export default AtsCheckerFaq;
