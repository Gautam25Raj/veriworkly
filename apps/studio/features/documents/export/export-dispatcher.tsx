import type { BaseDocument, ExportFormat } from "@/features/documents/core/types";

import { getDocumentDefinition } from "@/features/documents/core/registry";

/**
 * Exports a document in the requested format.
 *
 * Type dispatch lives in `DocumentDefinition.loadExporter` rather than a `switch`
 * here, for two reasons:
 *
 *  1. Bundle size. Each type's handlers sit behind a dynamic `import()`, so nothing
 *     that merely lists or edits documents pulls in `@react-pdf/renderer` (~1.8MB)
 *     or `docx` (~390KB), and exporting a resume never loads the cover letter
 *     templates.
 *  2. Extensibility. A new document type registers its own exporter in the registry;
 *     it cannot silently fall through to another type's handler, which is what the
 *     previous `if (RESUME) … else assume cover letter` shape allowed.
 *
 * This module intentionally has no heavy static imports — keep it that way.
 */
export async function exportDocumentByType(
  document: BaseDocument,
  format: ExportFormat,
): Promise<void> {
  const definition = getDocumentDefinition(document.type);

  if (!definition.exportFormats.includes(format)) {
    throw new Error(`${definition.label} cannot be exported as ${format}`);
  }

  const exporter = await definition.loadExporter(format);

  return exporter(document);
}
