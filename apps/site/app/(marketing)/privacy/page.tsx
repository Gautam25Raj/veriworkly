import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/utils/metadata";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { Card, Badge } from "@veriworkly/ui";

import { PublicPageShell } from "@/components/layout/PublicPageShell";
import { LegalSections } from "@/components/legal/LegalSections";
import {
  privacySections,
  privacyEffectiveDate,
  privacyLastUpdated,
} from "@/features/legal/privacyContent";

const pageUrl = `${siteConfig.url}/privacy`;

export const metadata: Metadata = buildPageMetadata({
  path: "/privacy",
  title: `Privacy Policy: Privacy-First AI Career Workspace | ${siteConfig.shortName}`,
  description:
    "How VeriWorkly protects resumes, cover letters, and portfolios: local-first storage, encrypted sync, and stateless AI processing.",
  ogTitle: "Your Data Never Leaves Your Browser Without Asking",
  ogDescription:
    "See exactly what's stored locally, what syncs to the cloud, and what happens when you use AI features — no surprises, no fine print.",
  twitterTitle: "Local-first by default. Read the full policy.",
  twitterDescription:
    "Browser storage, encrypted sync, and stateless AI processing — the exact data boundaries VeriWorkly commits to in writing.",
  image: "/og/privacy-page-og.png",
  imageAlt: `${siteConfig.shortName} Privacy Policy`,
  keywords: [
    "VeriWorkly privacy policy",
    "local-first data storage",
    "privacy-first AI resume builder",
    "GDPR resume builder",
    "no data selling",
  ],
});

const privacyTopics = [
  {
    title: "Local-First Browser Storage",
    description:
      "Your documents and Master Profile facts are written to your browser's private storage (IndexedDB) first. Nothing is uploaded to our servers unless you log in, sync, or trigger a feature that requires it.",
  },
  {
    title: "Opt-In Portfolio Publishing",
    description:
      "Published portfolios and share links are only public because you chose to publish them. Password protection and one-click unpublishing are available at any time from your dashboard.",
  },
  {
    title: "Aggregate-Only Analytics",
    description:
      "Portfolio view counts and referrer stats are tracked in aggregate, without cookies and without building an individual profile of your visitors.",
  },
  {
    title: "No Selling, No Ad Trackers",
    description:
      "We never sell your data, and we don't run third-party ad trackers or heatmap scripts. GitHub and LinkedIn import run under your explicit authorization.",
  },
];

const PrivacyPage = () => {
  const privacySchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy | VeriWorkly",
    url: pageUrl,
    description:
      "Learn how VeriWorkly secures career data through local-first and encrypted workflows.",
    dateModified: privacyLastUpdated,
    inLanguage: "en-US",
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    about: {
      "@type": "Thing",
      name: "Privacy Policy",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(privacySchema)}
      />

      <PublicPageShell
        eyebrow="Privacy Policy"
        title="Your credentials belong to you"
        secondaryAction={{ href: "/contact", label: "Contact Us" }}
        primaryAction={{ href: "/security", label: "Read Security Policy" }}
        description="Learn how VeriWorkly handles resumes, cover letters, portfolios, ATS scans, AI credits, and billing transactions with local-first storage and optional cloud backups."
      >
        <p className="text-muted -mt-4 text-xs font-semibold tracking-wide uppercase">
          Effective & last updated: {privacyEffectiveDate}
        </p>

        <section aria-label="Quick summary" className="space-y-6">
          <p className="text-muted text-sm leading-7">
            The four cards below are a plain-language summary. They are not a substitute for the
            full policy — read the numbered sections underneath for the complete, legally
            controlling text.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {privacyTopics.map((topic) => (
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

        <LegalSections sections={privacySections} />

        <section className="text-muted border-border/60 border-t pt-6 text-sm">
          Have questions about your data privacy?{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-accent font-medium hover:underline"
          >
            Contact support directly
          </a>
          .
        </section>
      </PublicPageShell>
    </>
  );
};

export default PrivacyPage;
