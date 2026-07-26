import { pdf } from "@react-pdf/renderer";

import type { BaseDocument, ExportFormat } from "@/features/documents/core/types";
import type { ResumeData } from "@/types/resume";

import { downloadBlob } from "@/features/documents/export/download";
import { exportResumeAsPdf } from "@/features/documents/export/export-pdf";
import { exportDocumentAsDocx, exportResumeAsDocx } from "@/features/documents/export/export-docx";
import { exportResumeAsHtml } from "@/features/documents/export/export-html";
import { exportResumeAsJson } from "@/features/documents/export/export-json";
import { exportResumeAsText } from "@/features/documents/export/export-text";
import { exportResumeAsMarkdown } from "@/features/documents/export/export-markdown";

import { CoverLetterPdf } from "@/templates/cover-letter/pdf";
import { registerPdfFontById } from "@/templates/pdf/fonts";
import {
  buildCoverLetterHtml,
  buildCoverLetterMarkdown,
  buildCoverLetterText,
} from "@/templates/cover-letter/web";
import type { CoverLetterContent } from "@/features/cover-letter/types";
import { getDocumentFileBaseName } from "./export-file-names";

function assertNever(value: never, context: string): never {
  throw new Error(`${context}: unhandled case ${JSON.stringify(value)}`);
}

async function exportResumeDocumentByFormat(document: BaseDocument, format: ExportFormat) {
  const content = document.content as ResumeData;

  switch (format) {
    case "pdf":
      return exportResumeAsPdf(content);
    case "docx":
      return exportResumeAsDocx(content);
    case "html":
      return exportResumeAsHtml(content);
    case "markdown":
      return exportResumeAsMarkdown(content);
    case "json":
      return exportResumeAsJson(content);
    case "txt":
      return exportResumeAsText(content);
    default:
      return assertNever(format, "exportResumeDocumentByFormat");
  }
}

async function exportCoverLetterDocumentByFormat(document: BaseDocument, format: ExportFormat) {
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
      const html = buildCoverLetterHtml(content, document.templateId);
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
      const renderer = <CoverLetterPdf content={content} templateId={document.templateId} />;
      const blob = await pdf(renderer).toBlob();
      downloadBlob(blob, `${fileBase}.pdf`);
      return;
    }
    default:
      return assertNever(format, "exportCoverLetterDocumentByFormat");
  }
}

export async function exportDocumentByType(
  document: BaseDocument,
  format: ExportFormat,
): Promise<void> {
  switch (document.type) {
    case "RESUME":
      return exportResumeDocumentByFormat(document, format);
    case "COVER_LETTER":
      return exportCoverLetterDocumentByFormat(document, format);
    default:
      return assertNever(document.type, "exportDocumentByType");
  }
}
