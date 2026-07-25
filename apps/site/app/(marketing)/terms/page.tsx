import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/utils/metadata";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { Card, Badge } from "@veriworkly/ui";

import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { LegalSections } from "@/components/legal/LegalSections";
import { termsSections, termsEffectiveDate, termsLastUpdated } from "@/features/legal/termsContent";

const pageUrl = `${siteConfig.url}/terms`;

export const metadata: Metadata = buildPageMetadata({
  path: "/terms",
  title: `Terms of Service | ${siteConfig.shortName}`,
  description:
    "The complete terms for using VeriWorkly: account rules, AI and ATS disclaimers, billing, open-source licensing, and liability limits.",
  ogTitle: "The Rules, Written in Plain English",
  ogDescription:
    "What you can expect from VeriWorkly, what we expect from you, and how billing, AI features, and open-source licensing actually work.",
  twitterTitle: "Read the terms before you build. It's short.",
  twitterDescription:
    "Account rules, AI/ATS disclaimers, billing terms, and open-source licensing for VeriWorkly's hosted service.",
  image: "/og/terms-page-og.png",
  imageAlt: `${siteConfig.shortName} Terms of Service`,
  keywords: [
    "VeriWorkly terms of service",
    "AI resume builder terms",
    "open source SaaS terms",
    "AI credit terms",
    "resume builder liability",
  ],
});

const termsTopics = [
  {
    title: "You Own Your Content",
    description:
      "You retain full ownership of your resumes, cover letters, portfolio content, and career facts. We only process it to run the Service you asked for.",
  },
  {
    title: "AI & ATS Output Is a Draft, Not a Guarantee",
    description:
      "AI writing and ATS scores are tools to help you draft faster — review them yourself. We don't guarantee interview or hiring outcomes.",
  },
  {
    title: "Local-First Means You Own the Backup Risk",
    description:
      "If you never log in, your data lives only in your browser. Export a backup or create a free account if you don't want to risk losing it.",
  },
  {
    title: "Open-Source Core, Separate License",
    description:
      "Our document engine is MIT-licensed on GitHub. That license governs self-hosting; these Terms govern using the hosted veriworkly.com service.",
  },
  {
    title: "As-Is Service, Capped Liability",
    description:
      "The Service is provided as-is. Because most usage is free, our liability is capped at what you've paid us, or a small flat amount if you've paid nothing.",
  },
  {
    title: "Fair Use on Free Tiers",
    description:
      "Rate limits, AI credit quotas, and ATS scan quotas exist so the free tier stays usable for everyone. Don't automate around them.",
  },
];

const TermsPage = () => {
  const termsSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service | VeriWorkly",
    url: pageUrl,
    description: "Terms of Service and guidelines for VeriWorkly career workspace.",
    dateModified: termsLastUpdated,
    inLanguage: "en-US",
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    about: {
      "@type": "Thing",
      name: "Terms of Service",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(termsSchema)} />

      <PublicPageShell
        eyebrow="Terms of Service"
        title="Simple, transparent guidelines"
        secondaryAction={{ href: "/contact", label: "Contact Us" }}
        primaryAction={{ href: "/about", label: "About the Project" }}
        description="Simple guidelines for using VeriWorkly. Review terms covering resumes, cover letters, portfolios, the ATS checker, AI credits, and billing services."
      >
        <p className="text-muted -mt-4 text-xs font-semibold tracking-wide uppercase">
          Effective & last updated: {termsEffectiveDate}
        </p>

        <section aria-label="Quick summary" className="space-y-6">
          <p className="text-muted text-sm leading-7">
            The cards below are a plain-language summary. They are not a substitute for the full
            Terms — read the numbered sections underneath for the complete, legally controlling
            text, including disclaimers and liability limits that apply to your use of the Service.
          </p>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {termsTopics.map((topic) => (
              <Card
                key={topic.title}
                className="border-border/80 hover:border-accent/30 flex flex-col justify-between border p-6 transition duration-300 md:p-8"
              >
                <div className="space-y-4">
                  <Badge className="bg-accent/10 text-accent w-fit border-none font-semibold">
                    Summary
                  </Badge>
                  <h3 className="text-foreground text-xl font-bold tracking-tight">
                    {topic.title}
                  </h3>
                  <p className="text-muted text-sm leading-6">{topic.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <LegalSections sections={termsSections} />

        <section className="text-muted border-border/60 border-t pt-6 text-sm">
          Have questions about these guidelines?{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-accent font-medium hover:underline"
          >
            Contact support
          </a>
          .
        </section>
      </PublicPageShell>
    </>
  );
};

export default TermsPage;
