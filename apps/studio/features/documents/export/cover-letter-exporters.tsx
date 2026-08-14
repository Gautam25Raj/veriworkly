// Exporting touches Blob/anchor download APIs and pulls in the cover letter preview
// module (which uses React hooks), so this is a client-only module. Required because
// `DocumentDefinition.loadExporter` is referenced from registry.tsx, which is itself
// reachable from server components.
"use client";

import { pdf } from "@react-pdf/renderer";

import type { BaseDocument, ExportFormat } from "@/features/documents/core/types";
import type { CoverLetterContent } from "@/features/cover-letter/types";

import { downloadBlob } from "@/features/documents/export/download";
import { exportDocumentAsDocx } from "@/features/documents/export/export-docx";
import { getDocumentFileBaseName } from "./export-file-names";

import { createCoverLetterPdfElement } from "@/templates/cover-letter/pdf";
import { registerPdfFontById } from "@/templates/pdf/fonts";
import {
  buildCoverLetterHtml,
  buildCoverLetterMarkdown,
  buildCoverLetterText,
} from "@/templates/cover-letter/web";

function assertNever(value: never, context: string): never {
  throw new Error(`${context}: unhandled case ${JSON.stringify(value)}`);
}

/**
 * Cover letter export handlers. Reached only through
 * `DocumentDefinition.loadExporter`'s dynamic `import()` — see resume-exporters.tsx.
 */
export async function exportCoverLetterDocument(
  document: BaseDocument,
  format: ExportFormat,
): Promise<void> {
  const content = document.content as CoverLetterContent;
  const fileBase = getDocumentFileBaseName(document);

  switch (format) {
    case "json": {
      downloadBlob(
        new Blob([JSON.stringify(document.content, null, 2)], { type: "application/json" }),
        `${fileBase}.json`,
      );
      return;
    }
    case "docx":
      return exportDocumentAsDocx(document);
    case "html": {
      const html = await buildCoverLetterHtml(content, document.templateId);
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${fileBase}.html`);
      return;
    }
    case "markdown": {
      const text = buildCoverLetterMarkdown(content);
      downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${fileBase}.md`);
      return;
    }
    case "txt": {
      const text = buildCoverLetterText(content);
      downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${fileBase}.txt`);
      return;
    }
    case "pdf": {
      registerPdfFontById(content.appearance?.fontFamily);
      const renderer = await createCoverLetterPdfElement({
        content,
        templateId: document.templateId,
      });
      const blob = await pdf(renderer).toBlob();
      downloadBlob(blob, `${fileBase}.pdf`);
      return;
    }
    default:
      return assertNever(format, "exportCoverLetterDocument");
  }
}
