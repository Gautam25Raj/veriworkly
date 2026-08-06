import type { TemplateSummary } from "@/config/templates";
import { siteConfig } from "@/config/site";

const portfolioBaseUrl =
  process.env.PORTFOLIO_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://portfolio.localhost:3004"
    : "https://portfolio.veriworkly.com");

export const getTemplateHref = (template: Pick<TemplateSummary, "documentType" | "id">) => {
  return `/templates/${template.documentType}/${template.id}`;
};

export const buildEditorUrl = (
  template: Pick<TemplateSummary, "editorTemplateId" | "documentType">,
) => {
  if (template.documentType === "portfolio-website") {
    return `${portfolioBaseUrl}/dashboard?template=${encodeURIComponent(template.editorTemplateId)}`;
  }

  const base = siteConfig.links.app;

  return `${base}/editor?template=${encodeURIComponent(template.editorTemplateId)}&type=${encodeURIComponent(template.documentType)}`;
};

export const buildPreviewUrl = (
  template: Pick<TemplateSummary, "editorTemplateId" | "documentType">,
) => {
  if (template.documentType === "portfolio-website") {
    return `${portfolioBaseUrl}/templates/${template.editorTemplateId}/preview`;
  }

  return null;
};
