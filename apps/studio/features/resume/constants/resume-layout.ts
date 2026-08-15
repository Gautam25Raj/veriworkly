import {
  DOCUMENT_PAGE_HEIGHT_PT,
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PT,
  DOCUMENT_PAGE_WIDTH_PX,
  DOCUMENT_PDF_SCALE,
  pxToPt,
} from "@/templates/shared/page-geometry";

/**
 * The page box is shared with every other document type — see
 * `templates/shared/page-geometry.ts`. These aliases exist so resume call sites can
 * keep reading `RESUME_PAGE_*`, but they must never diverge from the shared values.
 */
export const RESUME_PAGE_WIDTH_PX = DOCUMENT_PAGE_WIDTH_PX;
export const RESUME_PAGE_HEIGHT_PX = DOCUMENT_PAGE_HEIGHT_PX;
export const RESUME_PDF_SCALE = DOCUMENT_PDF_SCALE;
export const RESUME_PAGE_WIDTH_PT = DOCUMENT_PAGE_WIDTH_PT;
export const RESUME_PAGE_HEIGHT_PT = DOCUMENT_PAGE_HEIGHT_PT;

export { pxToPt };

export const RESUME_LAYOUT = {
  pagePadding: 32,
  sectionSpacing: 24,
  fontSize: 14,
  bodyLineHeight: 1.5,
  headingLineHeight: 1.1,
  headerNameSize: 30,
  headerRoleSize: 16,
  bodyTextSize: 12,
  mutedTextSize: 11,
  sectionTitleSize: 16,
  sectionTitleSpacing: 12,
  itemGap: 16,
} as const;
