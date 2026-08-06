import type { TemplateMeta } from "./types";
import type { DocumentType } from "./document-types";

import { precisionAtsMeta } from "@/templates/resume/precision-ats/meta";
import { executiveClarityMeta } from "@/templates/resume/executive-clarity/meta";
import { modernMinimalMeta } from "@/templates/resume/modern-minimal/meta";
import { timelineFocusMeta } from "@/templates/resume/timeline-focus/meta";
import { boldImpactMeta } from "@/templates/resume/bold-impact/meta";
import { corporateBriefMeta } from "@/templates/resume/corporate-brief/meta";
import { veriworklyCoverLetterMeta } from "@/templates/cover-letter/veriworkly/meta";
import { professionalCoverLetterMeta } from "@/templates/cover-letter/professional/meta";

/**
 * Template catalog per document type.
 *
 * IDs MUST match the `id` fields in:
 *   apps/studio/templates/resume/<id>/meta.ts
 *   apps/site/config/templates.ts
 *
 * They are used as `templateId` in stored documents and as URL slugs.
 */

export const templateCatalogByType: Record<DocumentType, TemplateMeta[]> = {
  RESUME: [
    executiveClarityMeta,
    precisionAtsMeta,
    modernMinimalMeta,
    timelineFocusMeta,
    corporateBriefMeta,
    boldImpactMeta,
  ],

  COVER_LETTER: [professionalCoverLetterMeta, veriworklyCoverLetterMeta],
};
