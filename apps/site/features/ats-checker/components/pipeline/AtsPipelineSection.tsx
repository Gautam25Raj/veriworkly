import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Search, TriangleAlert } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";
import { ENGINE_LINKS } from "@/features/ats-engine/data/content";

import { PIPELINE_STEPS } from "../../data/pipelineSteps";
import { SCORE_FACTS } from "../../data/scoreFacts";

const FRAGMENT = "bg-background rounded-2xl p-4 text-sm leading-6";

const FRAGMENTS: Record<(typeof PIPELINE_STEPS)[number]["phase"], ReactNode> = {
  Upload: (
    <div data-ui className={FRAGMENT}>
      <p className="text-muted">Extracted text</p>
      <p className="mt-2 font-medium">
        Senior Product Designer <span className="text-warning">Skills</span>
      </p>
      <p className="font-medium">
        Lumen Health <span className="text-warning">Figma, research</span>
      </p>
      <p className="font-medium">
        2022 to now <span className="text-warning">Design systems</span>
      </p>
    </div>
  ),
  Extract: (
    <dl data-ui className={`${FRAGMENT} grid grid-cols-[auto_1fr] gap-x-4 gap-y-1`}>
      <dt className="text-muted">Name</dt>
      <dd className="font-medium">Gautam Raj</dd>
      <dt className="text-muted">Title</dt>
      <dd className="font-medium">Senior Product Designer Skills</dd>
      <dt className="text-muted">Skills</dt>
      <dd className="text-destructive font-medium">Not found</dd>
      <dt className="text-muted">Dates</dt>
      <dd className="font-medium">2022 to now</dd>
    </dl>
  ),
  Search: (
    <div data-ui className={FRAGMENT}>
      <p className="flex items-center gap-2 font-medium">
        <Search aria-hidden="true" className="text-muted size-4" />
        Figma, design systems
      </p>
      <p className="text-muted mt-2 flex items-center gap-2">
        <TriangleAlert aria-hidden="true" className="text-warning size-4 shrink-0" />
        Gautam Raj is not in the results
      </p>
    </div>
  ),
  Review: (
    <div data-ui className={FRAGMENT}>
      <p className="flex items-center gap-2 font-medium">
        <FileText aria-hidden="true" className="text-muted size-4" />
        gautam-raj-resume.pdf
      </p>
      <p className="mt-2 flex gap-1.5">
        <span className="bg-card rounded-full px-3 py-0.5 font-medium">Parsed profile</span>
        <span className="text-muted rounded-full px-3 py-0.5">Original PDF</span>
      </p>
      <p className="text-muted mt-3">A recruiter reads both, side by side.</p>
    </div>
  ),
};

export function AtsPipelineSection() {
  return (
    <PageSection
      tone="card"
      title="What an ATS does to your resume."
      lede="Every check in the engine maps to one of these four stages. Here is one sample two-column resume going through them."
    >
      <ol className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE_STEPS.map((stage) => (
          <li key={stage.phase} className="reveal flex flex-col">
            {/* A shared height keeps the four stage names on one line across the row. */}
            <div className="*:h-full sm:h-44">{FRAGMENTS[stage.phase]}</div>
            <h3 className={`mt-6 ${TYPE.title}`}>{stage.phase}</h3>
            <p className="mt-1 text-base font-semibold">{stage.title}</p>
            <p className="text-muted mt-2 text-base leading-7 text-pretty">{stage.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-muted mt-10 text-sm">Sample resume.</p>
    </PageSection>
  );
}

export function AtsScoreFacts() {
  return (
    <PageSection
      tone="card"
      title="Three things to know about ATS scores."
      lede={
        <>
          The checker runs the{" "}
          <Link href="/ats-engine" className="text-accent font-semibold hover:underline">
            VeriWorkly ATS Engine
          </Link>
          , open source on{" "}
          <a
            href={ENGINE_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-semibold hover:underline"
          >
            GitHub
          </a>{" "}
          and{" "}
          <a
            href="https://www.npmjs.com/package/@veriworkly/ats-engine"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-semibold hover:underline"
          >
            npm
          </a>
          . You can{" "}
          <a
            href={ENGINE_LINKS.rubric}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-semibold hover:underline"
          >
            read every rule and its weight
          </a>
          .
        </>
      }
    >
      <dl>
        {SCORE_FACTS.map((fact) => (
          <div
            key={fact.title}
            className="reveal border-border grid gap-3 border-t py-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-12"
          >
            <dt className={`text-balance ${TYPE.title}`}>{fact.title}</dt>
            <dd className="text-muted max-w-2xl text-base leading-7 text-pretty">{fact.body}</dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}

export default AtsPipelineSection;
