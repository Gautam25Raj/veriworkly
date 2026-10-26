import { FileText, Mail, type LucideIcon } from "lucide-react";

import type { DocumentType } from "./document-types";

import { getDocumentDefinition } from "./registry";

/**
 * Named imports only: a namespace import with a lookup by string defeats tree-shaking and
 * puts the whole lucide set into every route that shows a document icon.
 */
const DOCUMENT_ICONS: Record<string, LucideIcon> = { FileText, Mail };

export function getDocumentIcon(type: DocumentType): LucideIcon {
  return DOCUMENT_ICONS[getDocumentDefinition(type).icon] ?? FileText;
}
