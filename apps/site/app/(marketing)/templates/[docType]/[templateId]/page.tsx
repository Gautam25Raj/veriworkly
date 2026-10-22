import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";

import {
  templateSummaries,
  getDocumentTypeSummary,
  getTemplatesByDocumentType,
  getTemplateByDocumentTypeAndId,
} from "@/config/templates";
import { siteConfig } from "@/config/site";

import { jsonLdScriptProps } from "@/utils/json-ld";
import { buildPageMetadata } from "@/utils/metadata";

import { PageHero, PageSection, TYPE } from "@/components/marketing/PageLayout";

import TemplatePreview from "@/features/templates/TemplatePreview";
import { buildEditorUrl, buildPreviewUrl, getTemplateHref } from "@/features/templates/utils";

/** How many sibling templates the closing row suggests. */
const MORE_COUNT = 3;

type PageProps = {
  params: Promise<{ docType: string; templateId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { docType, templateId } = await params;

  const template = getTemplateByDocumentTypeAndId(docType, templateId);

  if (!template) {
    return buildPageMetadata({
      path: `/templates/${docType}/${templateId}`,
      title: "Template Not Found | VeriWorkly",
      description: "This template does not exist or has been retired.",
      ogTitle: "Template Not Found",
      ogDescription: "This template does not exist or has been retired.",
      twitterTitle: "Template Not Found",
      twitterDescription: "This template does not exist or has been retired.",
      image: "/og/templates-page-og.png",
      noIndex: true,
    });
  }

  const templateTypeLabel = template.documentTypeLabel.toLowerCase();

  return buildPageMetadata({
    path: `/templates/${docType}/${templateId}`,
    title: template.seo.title,
    description: template.seo.description,
    ogTitle: `${template.name}: A ${templateTypeLabel} Template Built for ${template.audience[0] ?? "Job Seekers"}`,
    ogDescription: template.shortDescription,
    twitterTitle: `${template.name} - ${template.documentTypeLabel} Template`,
    twitterDescription: template.shortDescription,
    image: template.previewImage,
    imageAlt: `${template.name} ${templateTypeLabel} template preview`,
    imageWidth: 1200,
    imageHeight: 1600,
    keywords: [template.name, ...template.tags, `${template.documentTypeLabel} template`],
  });
}

export function generateStaticParams() {
  return templateSummaries.map((template) => ({
    docType: template.documentType,
    templateId: template.id,
  }));
}

/**
 * The template catalogue is a build-time constant and anything outside it 404s, so
 * unknown slugs should be rejected by the router rather than server-rendered.
 */
export const dynamicParams = false;

const TemplateDetailPage = async ({ params }: PageProps) => {
  const { docType, templateId } = await params;

  const docTypeData = getDocumentTypeSummary(docType);
  const template = getTemplateByDocumentTypeAndId(docType, templateId);

  if (!docTypeData || !template) notFound();

  const editorUrl = buildEditorUrl(template);
  const moreTemplates = getTemplatesByDocumentType(docType)
    .filter((other) => other.id !== template.id)
    .slice(0, MORE_COUNT);
  const previewUrl = buildPreviewUrl(template);
  const isPortfolioTemplate = template.documentType === "portfolio-website";
  const designPrinciples = isPortfolioTemplate
    ? [
        "The template behaves like a real public website rather than a static document preview.",
        "The same portfolio profile can move between website templates without losing content.",
        "The hierarchy is tuned for proof first: opening claim, project scan, and clear contact path.",
      ]
    : [
        "The template is designed around the first human scan before decorative detail.",
        "Spacing and hierarchy keep exported pages readable, credible, and easy to compare.",
        "The system balances visual distinction with safe structure for the document type.",
      ];
  const implementationNotes = isPortfolioTemplate
    ? [
        "Supports public VeriWorkly subdomain publishing.",
        "Works with portfolio metadata controls for title, description, and sharing.",
        "Uses the same portfolio content model as other website templates, so switching does not erase content.",
      ]
    : [
        "Exports from the document editor using production template assets.",
        "Keeps typography and spacing consistent with the selected document family.",
        "Uses editor-ready content regions rather than flat image-only previews.",
      ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Templates", item: `${siteConfig.url}/templates` },
      {
        "@type": "ListItem",
        position: 3,
        name: docTypeData.pluralLabel,
        item: `${siteConfig.url}/templates/${docType}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: template.name,
        item: `${siteConfig.url}/templates/${docType}/${templateId}`,
      },
    ],
  };

  const creativeWorkSchema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${template.name} ${template.documentTypeLabel} Template`,
    description: template.seo.description,
    url: `${siteConfig.url}/templates/${docType}/${templateId}`,
    creator: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    audience: template.audience.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(creativeWorkSchema)}
      />

      <PageHero
        before={
          <Link
            href={`/templates/${template.documentType}`}
            className="text-muted hover:text-foreground group focus-visible:ring-accent/40 inline-flex items-center gap-2 rounded-full text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
            />
            All {template.documentTypeLabel.toLowerCase()} templates
          </Link>
        }
        // Names like "VeriWorkly Special" already take two lines at display size, so the
        // type is named in the back link and the stage rather than as a third line here.
        title={template.name}
        lede={template.description}
        aside={
          <div className="flex flex-wrap gap-3">
            <Link
              href={editorUrl}
              className="group bg-foreground text-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent/40 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
            >
              {isPortfolioTemplate ? "Use in Portfolio Builder" : "Use this template"}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
            {previewUrl && (
              <a
                href={previewUrl}
                className="border-border hover:bg-card focus-visible:ring-accent/40 inline-flex h-12 items-center gap-2 rounded-full border px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
              >
                Open live preview
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
          </div>
        }
      >
        {/* The stage: the real export, large, beside the reasons to pick it. */}
        <div
          className={`bg-card grid overflow-hidden rounded-3xl ${
            isPortfolioTemplate ? "" : "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
          }`}
        >
          <figure
            className={`bg-background flex flex-col items-center justify-center gap-4 ${
              isPortfolioTemplate ? "p-4 sm:p-8 lg:p-10" : "px-6 py-8 sm:p-12 lg:p-16"
            }`}
          >
            <TemplatePreview
              priority
              template={template}
              sizes={
                isPortfolioTemplate
                  ? "(min-width: 1180px) 1100px, 94vw"
                  : "(min-width: 1024px) 520px, 88vw"
              }
              className={isPortfolioTemplate ? "w-full" : "w-full max-w-lg"}
            />
            <figcaption className="text-muted text-center text-sm">
              {isPortfolioTemplate
                ? "Screenshot of the live template. Open the live preview for the full page."
                : "Rendered from the production template asset."}
            </figcaption>
          </figure>

          <div className="flex flex-col gap-8 p-6 sm:p-8 lg:p-12">
            <div>
              <h2 className={TYPE.title}>Why this one works.</h2>
              <p className="text-muted mt-3 max-w-xl text-base leading-7 text-pretty">
                {template.designVision}
              </p>
            </div>

            <ul
              className={`grid gap-4 text-base leading-7 ${isPortfolioTemplate ? "md:grid-cols-3" : ""}`}
            >
              {template.proofPoints.map((point) => (
                <li key={point} className="flex gap-3">
                  <Check className="text-accent mt-1.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-auto grid grid-cols-2 gap-6 text-base sm:grid-cols-3">
              {[
                { label: "Type", value: template.documentTypeLabel },
                { label: "Style system", value: template.family },
                { label: "Layout", value: template.layout },
              ].map((item) => (
                <div key={item.label} className="border-border border-t pt-4">
                  <dt className="text-muted text-sm">{item.label}</dt>
                  <dd className="mt-1 font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </PageHero>

      <PageSection
        tone="card"
        title="Who it's for."
        lede={`Built for ${template.audience.join(", ").toLowerCase()}.`}
      >
        <ul className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {template.bestFor.map((item) => (
            <li
              key={item}
              className="reveal border-border border-t pt-6 text-xl leading-8 font-semibold tracking-tight text-balance"
            >
              {item}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="How it's built."
        lede="The layout is more than a skin. These choices decide what a reader sees first and how the export scans."
      >
        <div className="grid gap-12 lg:grid-cols-3">
          {[
            { title: "Typography", items: template.typography },
            { title: "Design rules", items: designPrinciples },
            { title: "Behaviour", items: implementationNotes },
          ].map((column) => (
            <div key={column.title} className="reveal">
              <h3 className={TYPE.title}>{column.title}</h3>
              <ul className="mt-6 space-y-5">
                {column.items.map((item) => (
                  <li
                    key={item}
                    className="border-border text-muted border-t pt-5 text-base leading-7"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        tone="card"
        title="Section by section."
        lede="What each part of the template holds, from the top of the page down."
      >
        <ol className="divide-border bg-background divide-y overflow-hidden rounded-3xl">
          {template.structure.map((section) => (
            <li
              key={section.title}
              className="grid gap-4 p-6 sm:p-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-10"
            >
              <div>
                <h3 className="text-xl font-bold tracking-tight">{section.title}</h3>
                <p className="text-muted mt-2 text-base leading-7 text-pretty">
                  {section.description}
                </p>
              </div>
              <ul className="flex flex-wrap content-start gap-2">
                {section.items.map((item) => (
                  <li key={item} className="bg-card rounded-full px-4 py-2 text-base">
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </PageSection>

      {moreTemplates.length > 0 && (
        <PageSection
          title={`More ${template.documentTypeLabel.toLowerCase()} templates.`}
          lede="Your content moves between templates, so trying another one costs nothing."
        >
          <ul
            className={
              isPortfolioTemplate
                ? "grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
                : "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3"
            }
          >
            {moreTemplates.map((other) => (
              <li key={other.id} className="reveal">
                <Link
                  href={getTemplateHref(other)}
                  className="group focus-visible:ring-accent/40 block rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
                >
                  <TemplatePreview
                    template={other}
                    sizes="(min-width: 1024px) 370px, 46vw"
                    className={`transition-transform duration-300 ease-out group-hover:-translate-y-1.5 ${
                      isPortfolioTemplate ? "" : "lg:mx-auto lg:max-w-xs"
                    }`}
                  />
                  <h3 className="group-hover:text-accent mt-4 text-xl font-bold tracking-tight transition-colors duration-200">
                    {other.name}
                  </h3>
                  <p className="text-muted mt-1 text-base">{other.family}</p>
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </>
  );
};

export default TemplateDetailPage;
