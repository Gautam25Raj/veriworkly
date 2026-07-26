import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@veriworkly/ui";
import { type Competitor } from "@/config/compare";

const CompareFAQSection = ({ competitor }: { competitor: Competitor }) => {
  if (competitor.faqs.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-foreground text-2xl font-bold tracking-tight">
        {competitor.name} vs VeriWorkly: FAQ
      </h2>

      <Accordion type="single">
        {competitor.faqs.map((faq, index) => (
          <AccordionItem key={index} value={`faq-${index}`}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};

export default CompareFAQSection;
