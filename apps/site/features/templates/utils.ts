import type { TemplateSummary } from "@/config/templates";
import { siteConfig } from "@/config/site";

export const getTemplateHref = (template: Pick<TemplateSummary, "documentType" | "id">) => {
  return `/templates/${template.documentType}/${template.id}`;
};

export const buildEditorUrl = (
  template: Pick<TemplateSummary, "editorTemplateId" | "documentType">,
) => {
  // The portfolio dashboard ignores ?template=, so link the portfolio app's own page for the template.
  if (template.documentType === "portfolio-website") {
    return `${siteConfig.links.portfolio}/templates/${encodeURIComponent(template.editorTemplateId)}`;
  }

  const base = siteConfig.links.app;

  return `${base}/editor?template=${encodeURIComponent(template.editorTemplateId)}&type=${encodeURIComponent(template.documentType)}`;
};

export const buildPreviewUrl = (
  template: Pick<TemplateSummary, "editorTemplateId" | "documentType">,
) => {
  if (template.documentType === "portfolio-website") {
    return `${siteConfig.links.portfolio}/templates/${template.editorTemplateId}/preview`;
  }

  return null;
};

export const templatesHeading = (label: string) =>
  `${label.charAt(0)}${label.slice(1).toLowerCase()} templates`;
