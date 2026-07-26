import type { Metadata } from "next";

import { Container } from "@veriworkly/ui";
import { siteConfig } from "@/config/site";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { buildPageMetadata } from "@/utils/metadata";
import { COMPETITORS } from "@/config/compare";

import CompetitorCard from "@/features/compare/components/CompetitorCard";

const pageUrl = `${siteConfig.url}/compare`;
const ogImage = `/api/og?title=${encodeURIComponent("Compare")}&description=${encodeURIComponent(
  "See how VeriWorkly stacks up against other resume builders.",
)}`;

export const metadata: Metadata = buildPageMetadata({
  path: "/compare",
  title: `Compare VeriWorkly to Other Resume Builders | ${siteConfig.shortName}`,
  description:
    "Honest, feature-by-feature comparisons of VeriWorkly against Rezi, Teal, Kickresume, Novoresume, Zety, and Enhancv — pricing, ATS checking, portfolios, and account requirements.",
  ogTitle: "How does VeriWorkly compare?",
  ogDescription:
    "Feature-by-feature comparisons against the other resume builders you're probably considering.",
  twitterTitle: "VeriWorkly vs. everyone else",
  twitterDescription:
    "Honest comparisons: pricing, ATS checking, portfolios, and account requirements.",
  image: ogImage,
  imageAlt: `${siteConfig.shortName} | Compare`,
  keywords: [
    "VeriWorkly vs Rezi",
    "VeriWorkly vs Teal",
    "VeriWorkly vs Kickresume",
    "VeriWorkly vs Novoresume",
    "VeriWorkly vs Zety",
    "VeriWorkly vs Enhancv",
    "best resume builder comparison",
    "free resume builder alternative",
  ],
});

const ComparePage = () => {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Compare", item: pageUrl },
    ],
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Compare VeriWorkly to Other Resume Builders | ${siteConfig.shortName}`,
    url: pageUrl,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: COMPETITORS.map((competitor, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `VeriWorkly vs ${competitor.name}`,
        url: `${pageUrl}/${competitor.id}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(itemListSchema)}
      />

      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="surface-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.25]" />
        <div className="bg-accent/5 pointer-events-none absolute top-0 left-1/4 -z-10 h-150 w-150 rounded-full blur-[130px]" />

        <Container className="pt-28 pb-20 lg:pt-36">
          <div className="border-border/40 mb-12 flex flex-col gap-4 border-b pb-8">
            <div className="flex items-center gap-2">
              <span className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
              <span className="text-muted/90 font-mono text-[9px] font-bold tracking-widest uppercase">
                Compare
              </span>
            </div>

            <h1 className="text-foreground font-sans text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.95] font-bold tracking-tighter text-balance">
              How does VeriWorkly compare?
            </h1>

            <p className="text-muted max-w-2xl text-base leading-relaxed">
              Honest, feature-by-feature comparisons against the resume builders you&apos;re
              probably also considering — pricing, ATS checking, portfolios, and whether you need an
              account just to start.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITORS.map((competitor) => (
              <CompetitorCard key={competitor.id} competitor={competitor} />
            ))}
          </div>
        </Container>
      </div>
    </>
  );
};

export default ComparePage;
