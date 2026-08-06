import type { ComponentType } from "react";

import type { DocumentType } from "./document-types";
import type { BaseDocument, ExportFormat, TemplateMeta } from "./types";

export type DocumentExporter = (document: BaseDocument) => Promise<void>;

export interface DocumentDefinition<TContent = unknown> {
  type: DocumentType;
  label: string;
  icon: string;
  defaultTemplateId: string;
  exportFormats: ExportFormat[];
  templates: TemplateMeta[];
  createDefault: (id: string) => BaseDocument<TContent>;
  parse: (value: unknown) => BaseDocument<TContent> | null;
  /**
   * One-line card subtitle for list views (a resume's role, a cover letter's
   * "Job at Company"). Lives here so the storage index can be built generically
   * instead of the library switching on document type.
   */
  describe: (document: BaseDocument<TContent>) => string;
  Editor: ComponentType<{ documentId: string }>;
  /**
   * Resolves the handler for one export format, behind a dynamic `import()`.
   *
   * Must stay lazy. The export path statically pulls in `@react-pdf/renderer`
   * (~1.8MB) plus `docx` (~390KB); reaching it through a static import chain is
   * what previously put both on every route that merely *listed* documents.
   */
  loadExporter: (format: ExportFormat) => Promise<DocumentExporter>;
}
