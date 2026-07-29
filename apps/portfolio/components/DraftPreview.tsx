"use client";

import dynamic from "next/dynamic";

import { demoPortfolio, type TemplateId } from "@/lib/portfolio";
import { templateLoaders } from "@/template-library/registry";

const templates = Object.fromEntries(
  Object.entries(templateLoaders).map(([id, loader]) => [id, dynamic(loader)]),
) as Record<
  TemplateId,
  React.ComponentType<{ project: import("@/lib/portfolio").PortfolioContent }>
>;

export function DraftPreview({ templateId }: { templateId: TemplateId }) {
  const Template = templates[templateId];

  if (!Template) return null;

  return <Template project={{ ...demoPortfolio, templateId }} />;
}
