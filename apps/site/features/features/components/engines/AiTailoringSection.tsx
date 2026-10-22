import Link from "next/link";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

const AI_FACTS: Array<{
  title: string;
  detail: string;
  link?: { href: string; label: string };
}> = [
  {
    title: "Tailored to the posting",
    detail:
      "Paste a job description. The assistant pulls out the skills it asks for and reframes your real experience to match.",
  },
  {
    title: "Only your facts",
    detail:
      "It sharpens wording from what is already in your profile. It will not invent jobs, degrees or credentials you do not have.",
  },
  {
    title: "Cover letters too",
    detail:
      "Draft a letter for a specific company that leads with your most relevant wins, then edit it like any other document.",
  },
  {
    title: "Pay per use",
    detail:
      "AI runs on credit packs that last 90 days, or a monthly plan if you prefer. The free tier has no AI credits.",
    link: { href: "/pricing", label: "See AI pricing" },
  },
];

/** The review step, drawn as the studio shows it. The bullets are an illustration. */
const DiffFigure = () => (
  <figure>
    <div data-ui className="bg-card overflow-hidden rounded-3xl">
      <div className="grid lg:grid-cols-2">
        <div className="p-6 sm:p-8">
          <p className="text-muted flex items-center gap-2 text-sm font-semibold">
            <Minus aria-hidden="true" className="text-destructive size-4" />
            Your draft
          </p>
          <p className="text-muted mt-4 text-lg leading-8 line-through decoration-1">
            Responsible for improving frontend performance and helping the team with React
            components.
          </p>
        </div>

        <div className="bg-success/10 p-6 sm:p-8">
          <p className="text-success flex items-center gap-2 text-sm font-semibold">
            <Plus aria-hidden="true" className="size-4" />
            Suggestion
          </p>
          <p className="mt-4 text-lg leading-8 font-medium">
            Built a shared React component library used across 14 web services, cutting bundle size
            by 38%.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-2 pb-6 sm:px-8">
        <p className="text-muted text-sm">Nothing changes until you choose.</p>
        <div className="flex gap-2" aria-hidden="true">
          <span className="bg-background rounded-full px-4 py-2 text-sm font-semibold">
            Keep mine
          </span>
          <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold">
            <Check className="size-4" />
            Accept
          </span>
        </div>
      </div>
    </div>
    <figcaption className="text-muted mt-4 text-sm">
      Illustration of the review step. Your master document is never overwritten without your
      approval.
    </figcaption>
  </figure>
);

export const AiTailoringSection = () => (
  <PageSection
    id="ai-tailoring"
    title="AI suggests. You decide."
    lede="Target a resume to a specific job. The assistant proposes stronger, measurable bullet points, and you compare each one with your draft before accepting it."
  >
    <div className="reveal">
      <DiffFigure />
    </div>

    <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {AI_FACTS.map((fact) => (
        <div key={fact.title} className="reveal">
          <h3 className={`${TYPE.title} text-balance`}>{fact.title}</h3>
          <p className="text-muted mt-3 text-base leading-7 text-pretty">{fact.detail}</p>
          {fact.link ? (
            <Link
              href={fact.link.href}
              className="group text-accent mt-3 inline-flex min-h-11 items-center gap-2 text-base font-semibold"
            >
              {fact.link.label}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  </PageSection>
);

export default AiTailoringSection;
