import type { TemplateMeta } from "@/features/documents/core/types";

export const corporateBriefMeta = {
  id: "corporate-brief",
  name: "Corporate Brief",
  documentType: "RESUME",
  description:
    "A split letterhead with identity on the left and contact details on the right, plus accent-barred section headings. Reads like an internal business brief.",
  accentColor: "#1d4ed8",
  previewImage: "/templates/resume/corporate-brief.svg",
  tags: ["One column", "ATS-friendly", "Letterhead", "Corporate"],
} satisfies TemplateMeta;
