import type { ReactElement } from "react";
// Type-only, so this does not pull the renderer into any bundle.
import type { DocumentProps } from "@react-pdf/renderer";

import { createElement } from "react";

import type { CoverLetterContent } from "@/features/cover-letter/types";

import { coverLetterTemplateRegistry } from "./registry";

/**
 * Builds the PDF element for the selected cover letter template.
 *
 * Async because the template module is fetched on demand — the same boundary the
 * resume PDF path uses (`templates/resume/pdf/index.ts`), and what keeps
 * `@react-pdf/renderer` out of every bundle that merely references a document.
 */
export async function createCoverLetterPdfElement({
  content,
  templateId,
}: {
  content: CoverLetterContent;
  templateId?: string;
}): Promise<ReactElement<DocumentProps>> {
  const Template = await coverLetterTemplateRegistry.loadPdf(templateId);

  // Templates render a `<Document>` but declare their own props, which react-pdf's
  // element types cannot infer. The cast is confined to this one place.
  return createElement(Template, { content }) as unknown as ReactElement<DocumentProps>;
}
