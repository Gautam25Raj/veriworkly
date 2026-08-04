import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";

import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/utils/metadata";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { AtsCheckerTool } from "@/features/ats-checker/components/AtsCheckerTool";

const pageOgImage = `${siteConfig.url}/api/og?title=${encodeURIComponent(
  "Scan Your Resume",
)}&description=${encodeURIComponent("Free ATS readiness and job match scoring.")}`;

export const metadata: Metadata = buildPageMetadata({
  path: "/ats-checker/scan",
  title: `Scan Your Resume — Free ATS Checker | ${siteConfig.shortName}`,
  description:
    "Upload or paste your resume for a free ATS readiness score, a per-area breakdown, and job-description keyword match — no account required to start.",
  ogTitle: "Scan your resume — free",
  ogDescription: "Upload or paste your resume for an instant ATS readiness score.",
  twitterTitle: "Scan your resume — free ATS check",
  twitterDescription: "No account required to start.",
  image: pageOgImage,
  imageAlt: "VeriWorkly resume scan tool",
});

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
    {
      "@type": "ListItem",
      position: 2,
      name: "ATS Checker",
      item: `${siteConfig.url}/ats-checker`,
    },
    { "@type": "ListItem", position: 3, name: "Scan", item: `${siteConfig.url}/ats-checker/scan` },
  ],
};

export default function AtsCheckerScanPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
      />

      <div className="min-h-screen bg-white pt-28 pb-24 md:pt-32 dark:bg-[#000000]">
        <div className="mx-auto max-w-2xl px-6 md:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link
              href="/ats-checker"
              className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-zinc-600 transition hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-zinc-300 dark:hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> ATS Checker
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Lock className="h-3 w-3" aria-hidden="true" /> Nothing stored
            </span>
          </div>

          {/*
            The tool is the page, so it needs the h1 — without one this route had no top-level
            heading at all, which breaks the document outline for screen readers and leaves
            crawlers with only the <title>.
          */}
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tighter text-balance text-zinc-900 md:text-4xl dark:text-white">
              Scan your resume
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
              Two steps and a score. Add a job description in step two if you want keyword match for
              a specific role.
            </p>
          </header>

          <AtsCheckerTool />
        </div>
      </div>
    </>
  );
}
