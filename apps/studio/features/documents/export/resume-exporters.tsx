// Client-only for the same reason as cover-letter-exporters.tsx: these run in the
// browser, and the module is reached from registry.tsx which server components import.
"use client";

import type { BaseDocument, ExportFormat } from "@/features/documents/core/types";
import type { DocumentExportOptions } from "@/features/documents/core/definition";
import type { ResumeData } from "@/types/resume";

function assertNever(value: never, context: string): never {
  throw new Error(`${context}: unhandled case ${JSON.stringify(value)}`);
}

/**
 * Resume export handlers.
 *
 * Each format imports its own module when it runs, so exporting JSON, Markdown or text
 * never downloads `@react-pdf/renderer` (~1.8MB) or `docx` (~390KB). This module is itself
 * reached only through `DocumentDefinition.loadExporter`'s dynamic `import()`.
 */
export async function exportResumeDocument(
  document: BaseDocument,
  format: ExportFormat,
  options?: DocumentExportOptions,
): Promise<void> {
  const content = document.content as ResumeData;

  switch (format) {
    case "pdf": {
      const { exportResumeAsPdf } = await import("@/features/documents/export/export-pdf");
      return exportResumeAsPdf(content);
    }
    case "docx": {
      const { exportResumeAsDocx } = await import("@/features/documents/export/docx/resume-docx");
      return exportResumeAsDocx(content);
    }
    case "html": {
      /*
       * Resume HTML export stays WYSIWYG wherever a rendered preview exists, because that is
       * the output every existing user already gets from the editor and it reflects the
       * template they chose. `previewElementId` is absent on surfaces with nothing rendered to
       * scrape (the document list, a share page), and `exportResumeAsHtml` generates the
       * document from `ResumeData` there. One exporter, one decision point.
       */
      const { exportResumeAsHtml } = await import("@/features/documents/export/export-html");
      return exportResumeAsHtml(content, options?.previewElementId);
    }
    case "markdown": {
      const { exportResumeAsMarkdown } =
        await import("@/features/documents/export/export-markdown");
      return exportResumeAsMarkdown(content);
    }
    case "json": {
      const { exportResumeAsJson } = await import("@/features/documents/export/export-json");
      return exportResumeAsJson(content);
    }
    case "txt": {
      const { exportResumeAsText } = await import("@/features/documents/export/export-text");
      return exportResumeAsText(content);
    }
    default:
      return assertNever(format, "exportResumeDocument");
  }
}
