import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { siteConfig } from "@/config/site";

import { FRAME, TYPE } from "./PageLayout";

const DESTINATIONS = [
  {
    href: "/templates",
    title: "Templates",
    description: "Resume, cover letter and portfolio layouts.",
  },
  {
    href: "/ats-checker",
    title: "ATS checker",
    description: "Score a resume against a job post, free.",
  },
  { href: "/pricing", title: "Pricing", description: "What is free, and what costs money." },
  { href: "/changelog", title: "Changelog", description: "Every release, with its pull requests." },
];

interface StatusPageProps {
  title: ReactNode;
  highlight: ReactNode;
  lede: ReactNode;
  actions: ReactNode;
  destinations?: boolean;
  as?: "main" | "section";
}

export function StatusPage({
  title,
  highlight,
  lede,
  actions,
  destinations = false,
  as: Tag = "section",
}: StatusPageProps) {
  return (
    <Tag className="flex min-h-[80svh] items-center pt-28 pb-20 lg:pt-36 lg:pb-28">
      <div className={FRAME}>
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
          <h1 className={`min-w-0 text-balance ${TYPE.display}`}>
            <span className="block">{title}</span>
            <span className="text-accent block">{highlight}</span>
          </h1>

          <div className="border-border hero-rise min-w-0 border-t pt-6">
            <p className="text-muted max-w-md text-base leading-7 lg:text-lg lg:leading-8">
              {lede}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>
          </div>
        </div>

        {destinations ? (
          <ul className="hero-rise mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
            {DESTINATIONS.map((item) => (
              <li key={item.href} className="border-border border-t pt-5">
                <Link
                  href={item.href}
                  className="group focus-visible:ring-accent/40 block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="group-hover:text-accent flex items-center gap-2 text-xl font-bold tracking-tight transition-colors duration-200">
                    {item.title}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                  <span className="text-muted mt-2 block text-base leading-7">
                    {item.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Tag>
  );
}

const ACTION_BASE =
  "focus-visible:ring-accent/40 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]";

export const statusAction = {
  primary: `${ACTION_BASE} bg-foreground text-background hover:bg-accent hover:text-accent-foreground`,
  secondary: `${ACTION_BASE} border-border bg-card text-foreground hover:bg-background border`,
};

export function NotFoundPage() {
  return (
    <StatusPage
      destinations
      title="This page"
      highlight="isn't here."
      lede="It may have moved, or the link has a typo. One of these is probably what you were after."
      actions={
        <>
          <Link href="/" className={statusAction.primary}>
            Back to home
          </Link>
          <a href={siteConfig.links.app} className={statusAction.secondary}>
            Open Studio
          </a>
        </>
      }
    />
  );
}

const Bone = ({ className }: { className: string }) => (
  <div
    aria-hidden="true"
    className={`bg-foreground/6 animate-pulse rounded-2xl motion-reduce:animate-none ${className}`}
  />
);

export function LoadingPage({ as: Tag = "section" }: { as?: "main" | "section" }) {
  return (
    <Tag className="pt-28 pb-20 lg:pt-36 lg:pb-28">
      <p className="sr-only" role="status" aria-live="polite">
        Loading page
      </p>

      <div className={FRAME}>
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-14">
          <div className="space-y-4">
            <Bone className="h-[clamp(2.5rem,5.4vw,5rem)] w-4/5" />
            <Bone className="h-[clamp(2.5rem,5.4vw,5rem)] w-3/5" />
          </div>
          <div className="border-border space-y-3 border-t pt-6">
            <Bone className="h-4 w-full rounded-full" />
            <Bone className="h-4 w-11/12 rounded-full" />
            <Bone className="h-4 w-2/3 rounded-full" />
            <div className="flex gap-3 pt-4">
              <Bone className="h-12 w-36 rounded-full" />
              <Bone className="h-12 w-32 rounded-full" />
            </div>
          </div>
        </div>

        <Bone className="mt-16 h-72 w-full rounded-3xl lg:mt-24" />
      </div>
    </Tag>
  );
}
