import { Plus } from "lucide-react";

import { FRAME, TYPE } from "@/components/marketing/PageLayout";

import { type Competitor } from "../../types";

interface CompareFAQSectionProps {
  competitor: Competitor;
}

/** Native disclosure elements: answers work without script, with find-in-page and with screen readers. */
export const CompareFAQSection = ({ competitor }: CompareFAQSectionProps) => {
  if (competitor.faqs.length === 0) return null;

  return (
    <section id="questions" className="border-border bg-card scroll-mt-24 border-b py-20 lg:py-28">
      <div className={`${FRAME} grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-16`}>
        <div className="lg:sticky lg:top-32 lg:self-start">
          <h2 className={`reveal text-balance ${TYPE.section}`}>Questions people ask.</h2>
          <p className="text-muted reveal mt-5 max-w-sm text-base leading-7 text-pretty">
            Straight answers on {competitor.name} and VeriWorkly, from the same checked sources as
            the tables above.
          </p>
        </div>

        <div>
          {competitor.faqs.map((faq, index) => (
            <details
              key={faq.question}
              open={index === 0}
              className="group border-border reveal border-t last:border-b"
            >
              <summary className="focus-visible:ring-accent/40 flex cursor-pointer list-none items-start justify-between gap-6 rounded-xl py-5 text-lg leading-7 font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
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
      </div>
    </section>
  );
};

export default CompareFAQSection;
