import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import MarginPreview from "./MarginPreview";

const STUDIO_FACTS = [
  {
    term: "Three typefaces",
    detail: "Geist, Manrope and Inter, chosen for legibility on screen and in print.",
  },
  {
    term: "Adjustable margins",
    detail: "From 16px to 52px, to fit your history onto one page or two.",
  },
  {
    term: "Sections you control",
    detail: "Add, reorder or hide Projects, Publications, Awards and more by dragging.",
  },
  {
    term: "A preview you can trust",
    detail: "An automated parity suite checks the live preview against the compiled PDF.",
  },
];

export const StudioFeatureSection = () => (
  <PageSection
    id="studio"
    tone="card"
    title="Write it once. Tailor it per job."
    lede="Tailor a resume to each application from your Master Profile, and draft a cover letter in the same type and theme."
  >
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="reveal min-w-0">
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {STUDIO_FACTS.map((fact) => (
            <div key={fact.term} className="border-border border-t py-6">
              <dt className={TYPE.title}>{fact.term}</dt>
              <dd className="text-muted mt-2 text-base leading-7 text-pretty">{fact.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="border-border text-muted border-t pt-6 text-base leading-7 text-pretty">
          Keep as many drafts as you like on your device. A free account syncs one active document
          per type, and Creator Pro lifts that.
        </p>

        <Link
          href="/templates/resume"
          className="group text-accent mt-6 inline-flex min-h-11 items-center gap-2 text-base font-semibold"
        >
          Browse resume templates
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:translate-x-1"
          />
        </Link>
      </div>

      <div className="reveal min-w-0">
        <MarginPreview />
      </div>
    </div>
  </PageSection>
);

export default StudioFeatureSection;
