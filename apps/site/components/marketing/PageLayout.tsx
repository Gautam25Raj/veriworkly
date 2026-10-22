import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";

/**
 * The page frame and section primitives every secondary marketing page is built from.
 *
 * They follow the pricing page: one 1180px frame, a left-aligned display headline whose last
 * line takes the accent, a split row of heading and lede, and sections separated by a step in
 * ground tone rather than by ornaments. Keeping it in one file means a change to the rhythm
 * lands on every page at once.
 */

export const FRAME = "mx-auto w-[min(1180px,calc(100%-32px))]";

/**
 * The type scale. Five sizes do the visible work on every page; anything larger than `title`
 * comes from here, never from a one-off clamp.
 */
export const TYPE = {
  /** The page's h1. One per page. */
  display: "text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.92] font-bold tracking-tighter",
  /** A section's h2. */
  section: "text-[clamp(2rem,3.6vw,3.25rem)] leading-none font-bold tracking-tighter",
  /** A large number in a figure or stat. */
  figure: "text-[clamp(2rem,3.4vw,3rem)] leading-none font-bold tracking-tighter tabular-nums",
  /** A block or card heading inside a section. */
  title: "text-xl leading-snug font-bold tracking-tight lg:text-2xl",
  /** The paragraph that introduces a page or section. */
  lede: "text-base leading-7 lg:text-lg lg:leading-8",
} as const;

const TONES = {
  plain: "bg-background",
  card: "bg-card",
  accent: "bg-accent text-accent-foreground",
} as const;

export type SectionTone = keyof typeof TONES;

interface PageHeroProps {
  /** The headline in the foreground colour. Keep each line short. */
  title: ReactNode;
  /** Optional last line, set in the accent. */
  highlight?: ReactNode;
  lede: ReactNode;
  /** Sits under the lede in the right column: actions, a meta line, a toggle. */
  aside?: ReactNode;
  /** Above the headline: a back link or breadcrumb, never a label. */
  before?: ReactNode;
  /** Full-width content under the headline row. */
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  title,
  highlight,
  lede,
  aside,
  before,
  children,
  className,
}: PageHeroProps) {
  return (
    <section className={cn("border-border border-b pt-28 pb-16 lg:pt-36 lg:pb-20", className)}>
      <div className={FRAME}>
        {before ? <div className="mb-8">{before}</div> : null}

        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
          <h1 className={cn("min-w-0 text-balance", TYPE.display)}>
            <span className="block">{title}</span>
            {highlight ? <span className="text-accent block">{highlight}</span> : null}
          </h1>

          <div className="border-border hero-rise min-w-0 border-t pt-6">
            <p className={cn("text-muted max-w-md", TYPE.lede)}>{lede}</p>
            {aside ? <div className="mt-6">{aside}</div> : null}
          </div>
        </div>

        {children ? <div className="hero-rise mt-12 lg:mt-16">{children}</div> : null}
      </div>
    </section>
  );
}

interface SectionHeadingProps {
  title: ReactNode;
  lede?: ReactNode;
  /** Heading level. Sections are h2; a nested block inside one is h3. */
  as?: "h2" | "h3";
  className?: string;
}

export function SectionHeading({ title, lede, as: Tag = "h2", className }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "grid items-end gap-5 lg:gap-14",
        lede ? "lg:grid-cols-[1.1fr_.9fr]" : undefined,
        className,
      )}
    >
      <Tag className={cn("reveal max-w-3xl min-w-0 text-balance", TYPE.section)}>{title}</Tag>

      {lede ? (
        <p className="reveal max-w-xl min-w-0 border-t border-current/15 pt-5 text-base leading-7 opacity-80">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

interface PageSectionProps extends Omit<SectionHeadingProps, "as" | "className"> {
  id?: string;
  tone?: SectionTone;
  children?: ReactNode;
  className?: string;
  /** Spacing between the heading row and the content. */
  contentClassName?: string;
}

export function PageSection({
  id,
  title,
  lede,
  tone = "plain",
  children,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <section
      id={id}
      className={cn("border-border scroll-mt-24 border-b py-20 lg:py-28", TONES[tone], className)}
    >
      <div className={FRAME}>
        <SectionHeading title={title} lede={lede} />
        {children ? <div className={cn("mt-12 lg:mt-14", contentClassName)}>{children}</div> : null}
      </div>
    </section>
  );
}

interface PageClosingProps {
  title?: ReactNode;
  lede?: ReactNode;
  /** The quiet second action. Defaults to the template gallery. */
  secondary?: { label: string; href: string };
}

/**
 * The last section of a secondary page: one ink panel, one decision. The landing page keeps its
 * own closer; these pages end on the same frame and type as the rest of them.
 */
export function PageClosing({
  title = "Your next resume starts here.",
  lede = "Free to build and free to export, in every format. Sign up only when you want sync.",
  secondary = { label: "Browse templates", href: "/templates" },
}: PageClosingProps) {
  return (
    <section className="py-20 lg:py-28">
      <div className={FRAME}>
        <div className="reveal bg-foreground text-background grid gap-8 rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-14 lg:p-16">
          <h2 className={cn("max-w-2xl text-balance", TYPE.section)}>{title}</h2>

          <div>
            <p className={cn("max-w-md text-pretty opacity-75", TYPE.lede)}>{lede}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={siteConfig.links.app}
                className="group bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
              >
                Open Studio
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </a>
              <Link
                href={secondary.href}
                className="focus-visible:ring-accent inline-flex h-12 items-center rounded-full border border-current/40 px-6 text-base font-semibold transition-colors duration-200 hover:border-current focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
              >
                {secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
