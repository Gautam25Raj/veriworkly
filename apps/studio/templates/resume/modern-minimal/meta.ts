import type { TemplateMeta } from "@/features/documents/core/types";

export const modernMinimalMeta = {
  id: "modern-minimal",
  name: "Modern Minimal",
  documentType: "RESUME",
  description:
    "A quiet, rule-free layout with generous whitespace and small uppercase section labels. Best when the writing should carry the page instead of the styling.",
  accentColor: "#6366f1",
  previewImage: "/templates/resume/modern-minimal.svg",
  tags: ["One column", "ATS-friendly", "Minimal", "Whitespace"],
} satisfies TemplateMeta;
