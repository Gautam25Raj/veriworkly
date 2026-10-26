import type { DocumentType } from "@/features/documents/core/document-types";

import { templateSummaries } from "@/config/templates";
import { getDocumentRouteSegment } from "@/features/documents/core/routes";
// The catalog, not the cover-letter registry: the registry module pulls in the renderers' hooks,
// which a server page cannot import.
import { templateCatalogByType } from "@/features/documents/core/template-catalog";

export interface GalleryTemplate {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  tags: string[];
  /** Opens a new document wearing this template; at the free limit, the existing one. */
  href: string;
}

/** The editor entry route handles the free limit, so the gallery never creates a document itself. */
export function templateEditorHref(type: DocumentType, templateId: string) {
  const query = new URLSearchParams({ type: getDocumentRouteSegment(type), template: templateId });

  return `/editor?${query}`;
}

function toGalleryTemplate(
  type: DocumentType,
  template: Omit<GalleryTemplate, "href">,
): GalleryTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    previewImage: template.previewImage,
    tags: template.tags,
    href: templateEditorHref(type, template.id),
  };
}

/** Every template the studio ships, per document type, in the registries' display order. */
export const templateGallery: Record<DocumentType, GalleryTemplate[]> = {
  RESUME: templateSummaries.map((template) => toGalleryTemplate("RESUME", template)),
  COVER_LETTER: templateCatalogByType.COVER_LETTER.map((template) =>
    toGalleryTemplate("COVER_LETTER", template),
  ),
};
