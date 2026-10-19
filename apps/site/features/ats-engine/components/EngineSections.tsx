import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Scale } from "lucide-react";
import { GithubIcon } from "@veriworkly/ui";

import { Reveal } from "@/components/marketing/Reveal";

import {
  AUDIENCES,
  BENCHMARKS,
  CAPABILITIES,
  COMPARISON_COLUMNS,
  COMPARISON_ROWS,
  DETERMINISM_POINTS,
  ENGINE_LINKS,
  ENGINE_VERSION_LABEL,
  EXTRAS,
  HERO_FACTS,
  INSTALL_COMMAND,
  INTEGRITY_CHECKS,
  RUNTIMES,
  type EngineFeature,
} from "../data/content";
import { CodeTabs } from "./CodeTabs";
import { CopyCommand } from "./CopyCommand";
import { EngineDemo } from "./EngineDemo";

function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 text-left">
      <span className="text-accent font-mono text-[10px] font-bold tracking-widest uppercase">
        {eyebrow}
      </span>
      <h2
        id={id}
        className="text-foreground text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl"
      >
        {title}
      </h2>
      {intro ? (
        <p className="text-muted max-w-2xl text-sm leading-relaxed sm:text-base">{intro}</p>
      ) : null}
    </div>
  );
}

function FeatureGrid({ items, columns }: { items: EngineFeature[]; columns: string }) {
  return (
    <div className={`grid gap-5 ${columns}`}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Reveal key={item.title} delay={index * 0.05}>
            <div className="border-border/60 bg-card/40 hover:border-accent/40 flex h-full flex-col gap-3 rounded-2xl border p-6 backdrop-blur-sm transition-colors duration-200">
              <span className="bg-accent/10 text-accent ring-accent/20 flex size-9 items-center justify-center rounded-xl ring-1">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="text-foreground text-base font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">{item.body}</p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

export function EngineHero() {
  return (
    <div className="border-border/40 border-b pb-20">
      <div className="flex max-w-4xl flex-col items-start space-y-6 text-left">
        <Reveal priority>
          <div className="border-border/80 bg-card/60 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 shadow-xs backdrop-blur-md">
            <span className="text-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
              Open source · MIT
            </span>
            <span className="text-muted/60 font-mono text-[10px]">|</span>
            <span className="text-muted text-[11px]">
              @veriworkly/ats-engine {ENGINE_VERSION_LABEL}
            </span>
          </div>
        </Reveal>

        <Reveal priority delay={0.06}>
          <h1 className="text-foreground text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.04] font-bold tracking-tight text-balance">
            The open-source <span className="text-accent">ATS engine</span> for your product
          </h1>
        </Reveal>

        <Reveal priority delay={0.12}>
          <p className="text-muted max-w-2xl text-base leading-relaxed sm:text-lg">
            The VeriWorkly ATS Engine reads a resume the way an applicant tracking system does,
            recovers the fields it stores, scores it with a published rubric and matches it to a job
            posting, requirement by requirement. Deterministic, explainable, and small enough to run
            in the browser.
          </p>
        </Reveal>

        <Reveal priority delay={0.18} className="w-full">
          <div className="flex flex-col gap-4 pt-2">
            <CopyCommand command={INSTALL_COMMAND} />
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={ENGINE_LINKS.quickStart}
                className="bg-accent text-accent-foreground group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold shadow-md transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
              >
                <BookOpen className="size-4" aria-hidden="true" />
                Read the docs
              </a>
              <a
                href={ENGINE_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/80 bg-card/60 text-foreground hover:bg-card inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-all duration-200"
              >
                <GithubIcon className="size-4" aria-hidden="true" />
                View on GitHub
              </a>
              <a
                href="#demo"
                className="text-muted hover:text-foreground inline-flex items-center gap-1.5 px-2 py-3.5 text-sm font-semibold transition-colors"
              >
                Try it on a sample
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal priority delay={0.24} className="w-full pt-4">
          <dl className="border-border/30 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
            {HERO_FACTS.map((fact) => (
              <div key={fact.label} className="space-y-1">
                <dt className="text-muted text-[11px]">{fact.label}</dt>
                <dd className="text-foreground text-sm font-semibold tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </div>
  );
}

export function EngineDemoSection() {
  return (
    <section aria-labelledby="demo" className="scroll-mt-24 space-y-10">
      <SectionHeading
        id="demo"
        eyebrow="Live, in this page"
        title="Score a sample resume right here"
        intro="These are invented resumes. The engine loads into this page and scores them in your browser: nothing is uploaded. Edit the posting and watch the job match and the requirements change."
      />
      <EngineDemo />
    </section>
  );
}

export function EngineCapabilities() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="What it does"
        title="Read, recover, score and match"
        intro="An ATS does not rank a resume. It extracts the text, files it into fields recruiters search, and filters on them. The engine does the same, then tells you what got lost and how to fix it."
      />
      <FeatureGrid items={CAPABILITIES} columns="sm:grid-cols-2 lg:grid-cols-4" />
    </section>
  );
}

export function EngineDeterminism() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="No black box"
        title="A score you can explain, line by line"
        intro={
          <>
            There is no model in the score. Each point a resume loses traces back to one rule, the
            evidence it found and the fix.{" "}
            <a href={ENGINE_LINKS.rubric} className="text-accent font-semibold hover:underline">
              Read the full rubric
            </a>
            .
          </>
        }
      />
      <FeatureGrid items={DETERMINISM_POINTS} columns="md:grid-cols-3" />
    </section>
  );
}

export function EngineIntegrity() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="Integrity checks"
        title="Built to catch the tricks"
        intro="Tricks aimed at screening software come off the finished score as deductions. An honest resume never meets them: it scores exactly as if these rules did not exist."
      />
      <FeatureGrid items={INTEGRITY_CHECKS} columns="sm:grid-cols-2 lg:grid-cols-4" />
    </section>
  );
}

export function EngineSurfaces() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="Ship it anywhere"
        title="A library, a CLI, a GitHub Action and an MCP server"
        intro="One engine and one published rubric, wherever you run it. The CLI, the Action and the MCP server attach the built-in language and region packs; attach them in the library too and you get the same scores."
      />
      <CodeTabs />
    </section>
  );
}

export function EngineRuntimes() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="Runtimes and size"
        title="Import only what you use"
        intro="The core makes no network calls and has no file system access, so it runs wherever JavaScript does. Sizes are gzipped, for each entry point bundled on its own."
      />

      <div className="border-border/60 bg-card/40 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-xl text-left text-sm">
          <thead>
            <tr className="border-border/60 text-muted border-b text-xs">
              <th scope="col" className="px-5 py-3 font-semibold">
                Import
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                What it holds
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Runs in
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            {RUNTIMES.map((row) => (
              <tr key={row.subpath} className="border-border/40 border-b last:border-b-0">
                <td className="text-foreground px-5 py-3 font-mono text-xs">{row.subpath}</td>
                <td className="text-muted px-5 py-3">{row.what}</td>
                <td className="text-muted px-5 py-3">{row.where}</td>
                <td className="text-foreground px-5 py-3 text-right font-semibold tabular-nums">
                  {row.size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FeatureGrid items={EXTRAS} columns="md:grid-cols-3" />
    </section>
  );
}

export function EngineBenchmarks() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="Benchmarks"
        title="Measured on every release"
        intro={
          <>
            Each release is checked against hand-written resumes and 30 generated ones rendered as
            text, PDF, two-column PDF and DOCX. All of them are invented, so treat these as
            regression figures, not real-world accuracy. Engine {ENGINE_VERSION_LABEL}.{" "}
            <a href={ENGINE_LINKS.benchmarks} className="text-accent font-semibold hover:underline">
              How they are measured
            </a>
            .
          </>
        }
      />

      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENCHMARKS.map((benchmark) => (
          <div
            key={benchmark.label}
            className="border-border/60 bg-card/40 space-y-2 rounded-2xl border p-6"
          >
            <dd className="text-foreground text-3xl font-semibold tracking-tight tabular-nums">
              {benchmark.value}
            </dd>
            <dt className="text-muted text-sm leading-snug">{benchmark.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EngineAudiences() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="Who it is for"
        title="For products that help people apply"
        intro="Anywhere a candidate wants to know how their resume reads before a recruiter sees it."
      />
      <FeatureGrid items={AUDIENCES} columns="sm:grid-cols-2 lg:grid-cols-4" />

      <div className="border-border/60 bg-card/40 flex gap-4 rounded-2xl border p-6">
        <Scale className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="space-y-1.5">
          <h3 className="text-foreground text-sm font-semibold">Not for ranking applicants</h3>
          <p className="text-muted text-sm leading-relaxed">
            The engine is built for candidates checking their own resume. It is not designed or
            validated to screen, rank or filter people, which can bring legal duties under laws such
            as New York City&apos;s Local Law 144 and the EU AI Act.{" "}
            <a
              href={ENGINE_LINKS.responsibleUse}
              className="text-accent font-semibold hover:underline"
            >
              Responsible use
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

export function EngineComparison() {
  return (
    <section className="border-border/40 space-y-10 border-t pt-16">
      <SectionHeading
        eyebrow="How it compares"
        title="Open rules instead of a hosted black box"
        intro="Compared by kind of tool, not by vendor. What a given vendor offers varies, so check theirs."
      />

      <div className="border-border/60 bg-card/40 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead>
            <tr className="border-border/60 border-b">
              <th scope="col" className="text-muted px-5 py-3 text-xs font-semibold">
                <span className="sr-only">Feature</span>
              </th>
              {COMPARISON_COLUMNS.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-5 py-3 text-xs font-semibold ${index === 0 ? "text-accent" : "text-muted"}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label} className="border-border/40 border-b last:border-b-0">
                <th scope="row" className="text-foreground px-5 py-3 font-semibold">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className={`px-5 py-3 ${index === 0 ? "text-foreground font-medium" : "text-muted"}`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EngineHostedApi() {
  return (
    <section className="border-border/60 bg-card/40 grid gap-6 rounded-3xl border p-8 md:grid-cols-3 md:items-center">
      <div className="space-y-2 md:col-span-2">
        <span className="text-accent font-mono text-[10px] font-bold tracking-widest uppercase">
          Prefer not to host it?
        </span>
        <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          The VeriWorkly API runs the same engine
        </h2>
        <p className="text-muted text-sm leading-relaxed">
          With a VeriWorkly API key you can call <code className="font-mono">/ats/check</code>,{" "}
          <code className="font-mono">/ats/extract</code> and{" "}
          <code className="font-mono">/ats/analyze</code>. They share your account&apos;s scan
          quota: 2 scans a day on a free account and 300 per billing period on a paid plan. There is
          no separate developer plan yet. For volume, run the library yourself: it is free.
        </p>
      </div>
      <a
        href={ENGINE_LINKS.apiReference}
        className="border-border/80 bg-background text-foreground hover:bg-card inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors duration-200"
      >
        API reference
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </section>
  );
}

export function EngineCTA() {
  return (
    <section className="border-border/60 bg-card/40 relative overflow-hidden rounded-3xl border px-6 py-14 text-center sm:px-12">
      <div className="bg-accent/10 pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full blur-[100px]" />
      <div className="mx-auto max-w-2xl space-y-5">
        <h2 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
          Add an ATS check to your product this afternoon
        </h2>
        <p className="text-muted text-base leading-relaxed">
          One npm install, one function call, and a report you can show your users as it is.
        </p>
        <div className="flex justify-center">
          <CopyCommand command={INSTALL_COMMAND} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href={ENGINE_LINKS.quickStart}
            className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold shadow-md transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
          >
            Quick start
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <a
            href={ENGINE_LINKS.npm}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border/80 bg-background text-foreground hover:bg-card inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-colors duration-200"
          >
            npm package
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <Link
            href="/ats-checker"
            className="text-muted hover:text-foreground px-2 py-3.5 text-sm font-semibold transition-colors"
          >
            Or use the free checker
          </Link>
        </div>
      </div>
    </section>
  );
}
