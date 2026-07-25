import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { GithubIcon } from "@veriworkly/ui";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/utils/metadata";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { faqs, categories } from "@/features/faq/data/faqItems";
import InteractiveCTA from "@/features/marketing/cta/InteractiveCTA";
import { Reveal } from "@/components/marketing/Reveal";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import FaqInteractiveSection from "@/features/faq/FaqInteractiveSection";

export const metadata: Metadata = buildPageMetadata({
  path: "/faq",
  title: `FAQ: ATS Checker, AI Credits & Imports | ${siteConfig.shortName}`,
  description:
    "Answers on resumes, cover letters, the free ATS checker, GitHub/LinkedIn import, custom subdomains, AI credits, and billing.",
  ogTitle: "Got Questions About VeriWorkly? Start Here",
  ogDescription:
    "Searchable answers on documents, the ATS checker, imports, portfolios, AI credits, and billing — organized by topic.",
  twitterTitle: "Every VeriWorkly question, answered",
  twitterDescription:
    "From AI credits to ATS scoring to custom subdomains — search the VeriWorkly FAQ or browse by topic.",
  image: "/og/faq-page-og.png",
  imageAlt: "VeriWorkly FAQ",
  keywords: [
    "VeriWorkly FAQ",
    "AI resume builder questions",
    "ATS checker FAQ",
    "AI credits explained",
    "resume builder pricing questions",
  ],
});

const FAQPage = () => {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(faqSchema)} />

      <section className="relative w-full overflow-hidden bg-white pt-32 pb-16 md:pt-40 md:pb-20 dark:bg-[#000000]">
        <div className="pointer-events-none absolute top-0 left-1/2 h-95 w-full max-w-200 -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-500/10" />

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center md:px-8">
          <Reveal priority>
            <SectionEyebrow
              icon={HelpCircle}
              label={`${faqs.length} answers`}
              className="mx-auto"
            />
          </Reveal>
          <Reveal priority delay={0.06}>
            <h1 className="mt-6 text-4xl font-semibold tracking-tighter text-balance text-zinc-900 sm:text-5xl md:text-6xl dark:text-white">
              Frequently asked questions
            </h1>
          </Reveal>
          <Reveal priority delay={0.12}>
            <p className="mt-6 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
              Resumes, cover letters, portfolios, the ATS checker, GitHub/LinkedIn import, billing,
              and the developer API — search below or browse by topic.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {categories
                .filter((cat) => cat.id !== "all")
                .map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-white/5 dark:text-zinc-400"
                  >
                    <cat.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {cat.name}
                  </span>
                ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-300 px-6 pb-24 md:px-8 md:pb-32">
        <FaqInteractiveSection />
      </section>

      <section className="mx-auto w-full max-w-350 px-6 pb-24 md:px-8 md:pb-32">
        <Reveal className="relative overflow-hidden rounded-4xl bg-zinc-950 px-8 py-12 md:px-14 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(120,119,198,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,119,198,0.06)_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_70%_at_20%_50%,#000_60%,transparent_100%)] bg-size-[26px_26px]" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold tracking-widest text-blue-400 uppercase">
                Didn&apos;t find your answer?
              </p>
              <h3 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight text-balance text-white">
                VeriWorkly is open-source. Read the code, or ask the community.
              </h3>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href={siteConfig.links.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 transition-colors hover:bg-blue-500 hover:text-white"
              >
                <GithubIcon className="h-4 w-4" aria-hidden="true" />
                GitHub Repository
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-blue-400/40 hover:text-blue-300"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <InteractiveCTA />

      <section className="sr-only">
        <h2>VeriWorkly FAQ</h2>
        <p>
          Find answers about ATS-friendly resumes and cover letters, the free ATS checker, GitHub
          and LinkedIn import, custom portfolio subdomains, developer API keys, privacy policies,
          and AI credit usage.
        </p>
      </section>
    </>
  );
};

export default FAQPage;
