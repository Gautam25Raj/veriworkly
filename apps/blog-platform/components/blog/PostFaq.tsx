import { Accordion, Accordions } from "fumadocs-ui/components/accordion";

type PostFaqProps = {
  items: { question: string; answer: string }[];
};

/**
 * Renders frontmatter FAQ pairs. The same items are emitted as FAQPage JSON-LD,
 * so the visible answer and the structured answer never drift apart.
 */
export default function PostFaq({ items }: PostFaqProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-16 space-y-6">
      <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
        Frequently asked questions
      </h2>

      <Accordions type="single">
        {items.map(({ question, answer }) => (
          <Accordion key={question} title={question}>
            {answer}
          </Accordion>
        ))}
      </Accordions>
    </section>
  );
}
