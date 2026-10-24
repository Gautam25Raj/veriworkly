import type { TemplateSummary } from "@/config/templates";

/** The explorer is a client component, so only these fields go into the RSC payload, not the full summaries. */
const CARD_FIELDS = [
  "id",
  "name",
  "documentType",
  "documentTypeLabel",
  "editorTemplateId",
  "family",
  "layout",
  "previewImage",
  "shortDescription",
  "accentColor",
  "tags",
  "audience",
] as const;

export type TemplateCardData = Pick<TemplateSummary, (typeof CARD_FIELDS)[number]>;

export const toCardData = (template: TemplateSummary): TemplateCardData =>
  Object.fromEntries(CARD_FIELDS.map((key) => [key, template[key]])) as TemplateCardData;
