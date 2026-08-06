import type { TemplateMeta } from "@/features/documents/core/types";

export const boldImpactMeta = {
  id: "bold-impact",
  name: "Bold Impact",
  documentType: "RESUME",
  description:
    "A centered, high-contrast masthead with accent-underlined section headings. Made for career changes, senior pitches, and roles where presence matters.",
  accentColor: "#b91c1c",
  previewImage: "/templates/resume/bold-impact.svg",
  tags: ["One column", "ATS-friendly", "Centered header", "High contrast"],
} satisfies TemplateMeta;
