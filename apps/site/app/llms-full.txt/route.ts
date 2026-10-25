import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteConfig } from "@/config/site";
import { templateSummaries } from "@/config/templates";
import { categories, faqs } from "@/features/faq/data/faqItems";
import { COMPETITORS } from "@/features/compare/data/competitors";

/** Built from the same data the pages render, so it cannot drift from them. */
export const dynamic = "force-static";

const publicFile = (name: string) => readFileSync(join(process.cwd(), "public", name), "utf8");

export function GET() {
  const faqSection = categories
    .filter((category) => category.id !== "all")
    .map((category) => {
      const items = faqs.filter((faq) => faq.category === category.id);
      return [
        `### ${category.name}`,
        ...items.map((faq) => `**${faq.question}**\n\n${faq.answer}`),
      ].join("\n\n");
    })
    .join("\n\n");

  const templateSection = templateSummaries
    .map(
      (t) =>
        `- ${t.name} (${t.documentTypeLabel}, ${t.family}, ${t.layout}): ${t.shortDescription} ${siteConfig.url}/templates/${t.documentType}/${t.id}`,
    )
    .join("\n");

  const compareSection = COMPETITORS.map((c) =>
    [
      `### VeriWorkly vs ${c.name}`,
      c.verdict,
      `Pricing: ${c.pricingSummary}`,
      `Details: ${siteConfig.url}/compare/${c.id}`,
    ].join("\n\n"),
  ).join("\n\n");

  const body = [
    publicFile("llms.txt").trim(),
    "## Frequently asked questions",
    faqSection,
    "## Template catalogue",
    templateSection,
    "## Comparisons",
    compareSection,
    "## Pricing (pricing.md)",
    publicFile("pricing.md")
      .replace(/^# .*\n/, "")
      .trim(),
  ].join("\n\n");

  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
