import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { siteConfig } from "@/config/site";

import { FRAME, TYPE } from "@/components/marketing/PageLayout";

import { type Competitor } from "../../types";

interface CompareClosingProps {
  title: string;
  /** On a comparison page, the other builders, so the next comparison is one tap away. */
  others?: Competitor[];
}

/** The page's one accent field: the decision, the button that acts on it, and where to go next. */
export const CompareClosing = ({ title, others }: CompareClosingProps) => (
  <section className="bg-accent text-accent-foreground py-20 lg:py-28">
    <div className={FRAME}>
      <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
        <h2 className={`reveal text-balance ${TYPE.section}`}>{title}</h2>

        <div className="reveal">
          <p className="max-w-md text-base leading-7 text-pretty opacity-85">
            Nothing to install and nothing to cancel later. Pick a template, write, and export when
            it reads right.
          </p>
          <a
            href={siteConfig.links.app}
            className="group bg-accent-foreground text-accent focus-visible:ring-accent-foreground/60 mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
          >
            Start building free
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>
        </div>
      </div>

      {others && others.length > 0 ? (
        <nav
          aria-labelledby="more-comparisons"
          className="reveal mt-14 border-t border-current/20 pt-8 lg:mt-16"
        >
          <h3 id="more-comparisons" className="text-base font-semibold opacity-85">
            Compare VeriWorkly with
          </h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/compare/${other.id}`}
                  className="group focus-visible:ring-accent-foreground/60 inline-flex h-11 items-center gap-2 rounded-full bg-current/10 pr-4 pl-1.5 text-base font-semibold transition-[transform,background-color] duration-150 hover:bg-current/20 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: other.color }}
                    className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  >
                    {other.initials}
                  </span>
                  {other.name}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  </section>
);

export default CompareClosing;
