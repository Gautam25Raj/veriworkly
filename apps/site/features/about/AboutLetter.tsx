import { cn } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";

import { FRAME, TYPE } from "@/components/marketing/PageLayout";

/**
 * The founder's note, set like a letter: the heading and signature hold the left column, the
 * text reads at a comfortable size on the right. On a phone it runs heading, letter, signature.
 */
const AboutLetter = () => (
  <section className="bg-accent text-accent-foreground border-border border-b py-20 lg:py-28">
    <figure
      className={cn(
        FRAME,
        "grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:grid-rows-[auto_1fr] lg:gap-x-14",
      )}
    >
      <h2 className={cn("reveal text-balance", TYPE.section)}>Why this exists.</h2>

      <blockquote className="reveal max-w-2xl space-y-5 text-lg leading-8 text-pretty lg:row-span-2 lg:text-xl lg:leading-9">
        <p>
          A few years ago I spent a Sunday afternoon tailoring a resume for a job I really wanted.
          When I clicked &ldquo;Download PDF&rdquo;, the site asked for a couple of dollars for a
          trial that renewed into a subscription costing more than twenty a month.
        </p>
        <p>
          I built {siteConfig.shortName} so nobody has to deal with that again. You shouldn&apos;t
          need a subscription to download a document you wrote yourself.
        </p>
        <p>
          Creating and exporting documents is free, in every format. Paid plans cover premium
          portfolio templates, removing the portfolio badge and heavy AI use, which is what pays the
          servers.
        </p>
      </blockquote>

      <figcaption className="flex items-center gap-4 lg:self-end">
        <span
          aria-hidden="true"
          className="bg-accent-foreground text-accent flex size-12 items-center justify-center rounded-full text-base font-bold"
        >
          GR
        </span>
        <span>
          <span className="block text-base font-semibold">Gautam Raj</span>
          <span className="block text-sm opacity-80">Founder, {siteConfig.shortName}</span>
        </span>
      </figcaption>
    </figure>
  </section>
);

export default AboutLetter;
