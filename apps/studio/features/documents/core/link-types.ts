import { linkTypeSchema } from "@veriworkly/profile-core";

/**
 * Link data, shared by every document type. `@/types/resume` aliases these as
 * `ResumeLinkItem` / `ResumeLinkDisplayMode`, so generic surfaces (the shared `LinksEditor`,
 * the cover letter, the templates' link rendering) can name them neutrally.
 */

export type DocumentLinkType =
  | "github"
  | "linkedin"
  | "dribbble"
  | "twitter"
  | "portfolio"
  | "behance"
  | "medium"
  | "youtube"
  | "custom";

const DOCUMENT_LINK_TYPES: readonly DocumentLinkType[] = linkTypeSchema.options;

export function isDocumentLinkType(value: unknown): value is DocumentLinkType {
  return DOCUMENT_LINK_TYPES.includes(value as DocumentLinkType);
}

/**
 * All three modes are rendered by both document types' templates — resume and cover letter
 * alike go through `getLinkDisplayText`.
 */
export type DocumentLinkDisplayMode = "icon" | "url" | "icon-username";

export interface DocumentLinkItem {
  id: string;
  type: DocumentLinkType;
  label: string;
  url: string;
}

export interface DocumentLinks {
  displayMode: DocumentLinkDisplayMode;
  items: DocumentLinkItem[];
}
