import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { COMPETITORS } from "../../data";

/** Every comparison as one row: who it is, what it is good at, what it costs. */
const CompetitorList = () => (
  <PageSection
    id="comparisons"
    title="Pick a comparison."
    lede="Each page sets one builder beside VeriWorkly: where it wins, where it limits you, what it costs, and a full feature table."
  >
    <ul>
      {COMPETITORS.map((competitor) => (
        <li key={competitor.id} className="border-border reveal border-t last:border-b">
          <Link
            href={`/compare/${competitor.id}`}
            className="group focus-visible:ring-accent/40 grid items-center gap-x-8 gap-y-2 rounded-2xl py-6 focus-visible:ring-2 focus-visible:outline-none md:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
          >
            <span className="flex items-center gap-4">
              <span
                aria-hidden="true"
                style={{ backgroundColor: competitor.color }}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              >
                {competitor.initials}
              </span>
              <span
                className={`group-hover:text-accent transition-colors duration-200 ${TYPE.title}`}
              >
                <span className="sr-only">VeriWorkly vs </span>
                {competitor.name}
              </span>
            </span>

            <span className="text-muted text-base leading-7 text-pretty">
              {competitor.positioning}
            </span>

            <span className="text-base leading-6 font-semibold">{competitor.pricingModel}</span>

            <ArrowRight
              aria-hidden="true"
              className="text-muted group-hover:text-accent hidden size-6 transition-transform duration-200 group-hover:translate-x-1 md:block"
            />
          </Link>
        </li>
      ))}
    </ul>
  </PageSection>
);

export default CompetitorList;
