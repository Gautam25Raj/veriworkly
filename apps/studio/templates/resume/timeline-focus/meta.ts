import type { TemplateMeta } from "@/features/documents/core/types";

export const timelineFocusMeta = {
  id: "timeline-focus",
  name: "Timeline Focus",
  documentType: "RESUME",
  description:
    "Dates sit in a fixed left column so a recruiter can scan your chronology in one pass. Ideal for steady career progression and long tenures.",
  accentColor: "#0f766e",
  previewImage: "/templates/resume/timeline-focus.svg",
  tags: ["One column", "ATS-friendly", "Date gutter", "Chronological"],
} satisfies TemplateMeta;
