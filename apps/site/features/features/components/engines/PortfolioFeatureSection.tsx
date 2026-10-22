import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";

const THEMES = [
  { name: "Signal", plan: "Free, with a small badge" },
  { name: "Atelier", plan: "Free, with a small badge" },
  { name: "Nimbus", plan: "Paid plan" },
  { name: "Cipher", plan: "Paid plan" },
];

const PORTFOLIO_FACTS = [
  {
    title: "Your own subdomain",
    detail: "Claim yourname.veriworkly.com, with automatic SSL and delivery from the edge.",
  },
  {
    title: "Projects that sync",
    detail: "Case studies, GitHub repositories, demo links and skills, from the same profile.",
  },
  {
    title: "Clean SEO, no ad scripts",
    detail: "Pre-rendered semantic HTML with Open Graph cards and no tracking cookies.",
  },
];

/** A portfolio page as it renders on a subdomain. The person and projects are a sample. */
const BrowserFigure = () => (
  <figure>
    <div data-ui className="bg-background text-foreground overflow-hidden rounded-3xl">
      <div className="bg-card flex items-center gap-3 px-5 py-3.5">
        <span className="bg-background text-muted flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-1.5 text-sm">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">gautamraj.veriworkly.com</span>
        </span>
        <span className="text-muted hidden text-sm sm:inline">Signal theme</span>
      </div>

      <div className="p-6 sm:p-10">
        <p className="text-3xl font-bold tracking-tighter">Gautam Raj</p>
        <p className="text-muted mt-2 text-lg">
          Product designer. Healthcare onboarding and design systems.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["Onboarding, 38% faster", "Case study · Lumen Health"],
            ["Pulse design system", "Figma library · 120 components"],
          ].map(([title, meta]) => (
            <div key={title} className="bg-card rounded-2xl p-5">
              <p className="text-base font-semibold">{title}</p>
              <p className="text-muted mt-1 text-sm">{meta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    <figcaption className="mt-4 text-sm opacity-80">
      Sample portfolio. Build and preview yours today; publishing opens at launch.
    </figcaption>
  </figure>
);

export const PortfolioFeatureSection = () => (
  <PageSection
    id="portfolio"
    tone="accent"
    title="A portfolio on your own address."
    lede="Turn your resume into a fast, responsive website at yourname.veriworkly.com, with no tracking cookies. Build and preview yours now; publishing opens at launch."
  >
    <div className="grid gap-12 lg:grid-cols-[1.25fr_.75fr] lg:items-start">
      <div className="reveal min-w-0">
        <BrowserFigure />
      </div>

      <div className="space-y-8">
        {PORTFOLIO_FACTS.map((fact) => (
          <div key={fact.title} className="reveal">
            <h3 className={TYPE.title}>{fact.title}</h3>
            <p className="mt-2 text-base leading-7 text-pretty opacity-85">{fact.detail}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="reveal mt-14 grid grid-cols-2 gap-x-8 gap-y-2 lg:grid-cols-4">
      {THEMES.map((theme) => (
        <div key={theme.name} className="border-t border-current/25 py-5">
          <p className={TYPE.title}>{theme.name}</p>
          <p className="mt-1 text-base opacity-85">{theme.plan}</p>
        </div>
      ))}
    </div>

    <div className="reveal mt-6 flex flex-wrap gap-x-8">
      <Link
        href="/templates/portfolio-website"
        className="group inline-flex min-h-11 items-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
      >
        Explore portfolio templates
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-1"
        />
      </Link>
      <Link
        href="/pricing"
        className="group inline-flex min-h-11 items-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
      >
        Badge removal and premium themes
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-1"
        />
      </Link>
    </div>
  </PageSection>
);

export default PortfolioFeatureSection;
