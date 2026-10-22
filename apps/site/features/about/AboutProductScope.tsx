import Link from "next/link";
import { ArrowUpRight, FileSignature, FileText, Globe } from "lucide-react";

import { siteConfig } from "@/config/site";

import { PageSection } from "@/components/marketing/PageLayout";

const productScope = [
  {
    title: "Document Studio",
    href: "/features",
    description:
      "ATS-friendly resumes and matched cover letters, tailored to each job with AI assistance you control.",
  },
  {
    title: "Master Profile",
    href: "/how-it-works",
    description:
      "One canonical record of your career facts. It seeds every document and is never overwritten by document edits.",
  },
  {
    title: "Portfolio Builder",
    href: siteConfig.links.portfolio,
    description:
      "A responsive web portfolio on a hosted subdomain, with visitor analytics and SEO controls on paid plans.",
  },
  {
    title: "ATS Checker",
    href: "/ats-checker",
    description:
      "Score a resume against a job description, then close the gaps with AI tailoring and GitHub or LinkedIn import.",
  },
];

/** One sample fact, shown as each document would set it. Sample data. */
const FACT = "38%";

const views = [
  {
    icon: FileText,
    label: "Resume",
    before: "Redesigned patient onboarding at Lumen Health, cutting completion time by ",
    after: ".",
  },
  {
    icon: FileSignature,
    label: "Cover letter",
    before:
      "At Lumen Health I rebuilt onboarding from the first screen up, and patients now finish it ",
    after: " faster.",
  },
  {
    icon: Globe,
    label: "Portfolio",
    before: "Case study: onboarding, ",
    after: " faster",
  },
];

const ProfileFigure = () => (
  <figure className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
    <div data-ui className="bg-accent text-accent-foreground rounded-3xl p-6 sm:p-8">
      <p className="text-sm font-semibold opacity-80">Master Profile</p>
      <p className="mt-6 text-2xl font-bold tracking-tight">Gautam Raj</p>
      <p className="mt-1 text-base opacity-80">Product designer, 6 years</p>

      <dl className="mt-8 space-y-4 text-base">
        <div className="rounded-2xl bg-current/10 p-4">
          <dt className="text-sm opacity-75">Lumen Health, 2022 to now</dt>
          <dd className="mt-1 font-semibold">Onboarding completion time down {FACT}</dd>
        </div>
        <div className="rounded-2xl bg-current/10 p-4">
          <dt className="text-sm opacity-75">Skills</dt>
          <dd className="mt-1 font-semibold">Figma, research, design systems</dd>
        </div>
      </dl>
    </div>

    <ul className="grid gap-4">
      {views.map(({ icon: Icon, label, before, after }) => (
        <li key={label} data-ui className="reveal bg-card rounded-3xl p-6 sm:p-7">
          <p className="text-muted flex items-center gap-2 text-sm font-semibold">
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </p>
          <p className="mt-3 text-lg leading-7 font-medium">
            {before}
            <mark className="bg-accent/15 text-accent rounded px-1 font-bold">{FACT}</mark>
            {after}
          </p>
        </li>
      ))}
    </ul>

    <figcaption className="text-muted text-sm lg:col-span-2">
      One fact, written once, set three ways. Edit the resume line and the profile stays as it was.
      Sample profile.
    </figcaption>
  </figure>
);

const AboutProductScope = () => (
  <PageSection
    title="One profile. Every document."
    lede="Your career facts live once, in your Master Profile. Each resume, letter and portfolio takes its own copy, so tailoring one never rewrites the source."
  >
    <ProfileFigure />

    <ul className="mt-20 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {productScope.map((item) => {
        const external = item.href.startsWith("http");

        return (
          <li key={item.title} className="reveal">
            <Link
              href={item.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group focus-visible:ring-accent/40 block rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <h3 className="group-hover:text-accent flex items-center gap-2 text-xl font-bold tracking-tight transition-colors duration-200">
                {item.title}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </h3>
              <p className="text-muted mt-3 text-base leading-7">{item.description}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  </PageSection>
);

export default AboutProductScope;
