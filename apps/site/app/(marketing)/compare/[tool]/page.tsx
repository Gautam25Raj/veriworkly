import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Container } from "@veriworkly/ui";
import { siteConfig } from "@/config/site";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { buildPageMetadata } from "@/utils/metadata";
import { COMPETITORS, getCompetitor } from "@/config/compare";

import CompareVsHero from "@/features/compare/components/CompareVsHero";
import CompareHighlights from "@/features/compare/components/CompareHighlights";
import FeatureMatrixTable from "@/features/compare/components/FeatureMatrixTable";
import ComparePricingSection from "@/features/compare/components/ComparePricingSection";
import CompareCaveatNote from "@/features/compare/components/CompareCaveatNote";
import CompareFAQSection from "@/features/compare/components/CompareFAQSection";

interface PageProps {
  params: Promise<{ tool: string }>;
}

export function generateStaticParams() {
  return COMPETITORS.map((competitor) => ({ tool: competitor.id }));
}

/**
 * The competitor list is a build-time constant and anything outside it 404s, so unknown
 * slugs should be rejected by the router instead of spinning up a server render just to
 * call `notFound()`.
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tool } = await params;
  const competitor = getCompetitor(tool);

  if (!competitor) {
    return buildPageMetadata({
      path: `/compare/${tool}`,
      title: "Comparison Not Found | VeriWorkly",
      description: "This comparison is not available on VeriWorkly yet.",
      ogTitle: "Comparison Not Found",
      ogDescription: "This comparison is not available on VeriWorkly yet.",
      twitterTitle: "Comparison Not Found",
      twitterDescription: "This comparison is not available on VeriWorkly yet.",
      image: "/api/og?title=Not%20Found",
      noIndex: true,
    });
  }

  const ogImage = `/api/og?title=${encodeURIComponent(
    `VeriWorkly vs ${competitor.name}`,
  )}&description=${encodeURIComponent(competitor.positioning)}`;

  return buildPageMetadata({
    path: `/compare/${competitor.id}`,
    title: `VeriWorkly vs ${competitor.name}: Features & Pricing Compared | ${siteConfig.shortName}`,
    description: `Compare VeriWorkly and ${competitor.name} on pricing, ATS checking, portfolio building, and account requirements. ${competitor.positioning}`,
    ogTitle: `VeriWorkly vs ${competitor.name}`,
    ogDescription: competitor.positioning,
    twitterTitle: `VeriWorkly vs ${competitor.name}`,
    twitterDescription: competitor.pricingSummary,
    image: ogImage,
    imageAlt: `VeriWorkly vs ${competitor.name}`,
    keywords: [
      `VeriWorkly vs ${competitor.name}`,
      `${competitor.name} alternative`,
      `${competitor.name} vs VeriWorkly`,
      `free ${competitor.name} alternative`,
      "resume builder comparison",
    ],
  });
}

const CompareToolPage = async ({ params }: PageProps) => {
  const { tool } = await params;
  const competitor = getCompetitor(tool);

  if (!competitor) notFound();

  const pageUrl = `${siteConfig.url}/compare/${competitor.id}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${siteConfig.url}/compare` },
      {
        "@type": "ListItem",
        position: 3,
        name: `VeriWorkly vs ${competitor.name}`,
        item: pageUrl,
      },
    ],
  };

  const faqSchema =
    competitor.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: competitor.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
      />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(faqSchema)} />
      )}

      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="surface-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.25]" />
        <div className="bg-accent/5 pointer-events-none absolute top-0 left-1/4 -z-10 h-150 w-150 rounded-full blur-[130px]" />

        <Container className="space-y-12 pt-28 pb-20 lg:pt-36">
          <Link
            href="/compare"
            className="text-muted hover:text-foreground -mb-4 inline-flex w-fit items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All comparisons
          </Link>

          <CompareVsHero competitor={competitor} />

          <CompareHighlights competitor={competitor} />

          <section className="space-y-5">
            <h2 className="text-foreground text-2xl font-bold tracking-tight">
              Feature-by-feature
            </h2>
            <FeatureMatrixTable competitor={competitor} />
          </section>

          <section className="space-y-5">
            <h2 className="text-foreground text-2xl font-bold tracking-tight">Pricing</h2>
            <ComparePricingSection competitor={competitor} />
            <CompareCaveatNote competitorName={competitor.name} />
          </section>

          <CompareFAQSection competitor={competitor} />

          <div className="border-border/40 bg-card/30 relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border p-10 text-center">
            <div className="bg-accent/10 pointer-events-none absolute top-0 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />

            <h2 className="text-foreground relative text-2xl font-bold tracking-tight">
              Try VeriWorkly free — no login required
            </h2>
            <p className="text-muted relative max-w-lg text-sm leading-relaxed">
              Build a resume, cover letter, or portfolio in the browser right now. Create an account
              only if you want cross-device sync.
            </p>
            <Link
              href={siteConfig.links.app}
              className="bg-accent text-accent-foreground relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition duration-200 ease-out hover:opacity-90 active:scale-[0.97]"
            >
              Start building free
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
};

export default CompareToolPage;
