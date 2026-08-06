import type { CoverLetterContent } from "@/features/cover-letter/types";
import { DocumentFontLoader } from "@/features/documents/components/DocumentFontLoader";

import {
  buildCoverLetterText,
  buildCoverLetterMarkdown,
  COVER_LETTER_VERIWORKLY_ID,
} from "./shared";
import {
  ProfessionalCoverLetterPreview,
  buildProfessionalCoverLetterHtml,
} from "./professional/web";
import { VeriworklyCoverLetterPreview, buildVeriworklyCoverLetterHtml } from "./veriworkly/web";

export { buildCoverLetterMarkdown, buildCoverLetterText };
export { splitContactLinks, splitMarkdownLines, splitRichTextBlocks } from "./shared";

interface CoverLetterPreviewProps {
  content: CoverLetterContent;
  templateId: string;
}

export function CoverLetterPreview({ content, templateId }: CoverLetterPreviewProps) {
  return (
    <>
      <DocumentFontLoader />
      {templateId === COVER_LETTER_VERIWORKLY_ID ? (
        <VeriworklyCoverLetterPreview content={content} />
      ) : (
        <ProfessionalCoverLetterPreview content={content} />
      )}
    </>
  );
}

export function buildCoverLetterHtml(content: CoverLetterContent, templateId: string): string {
  if (templateId === COVER_LETTER_VERIWORKLY_ID) {
    return buildVeriworklyCoverLetterHtml(content);
  }

  return buildProfessionalCoverLetterHtml(content);
}
