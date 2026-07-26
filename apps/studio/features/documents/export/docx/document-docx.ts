import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import type { BaseDocument } from "@/features/documents/core/types";
import type { CoverLetterContent } from "@/features/cover-letter/types";
import {
  getLinkDisplayText,
  normalizeLinkHref,
} from "@/features/documents/rendering/resume-rendering";
import { splitMarkdownLines, splitRichTextBlocks } from "@/templates/cover-letter/web";

import { downloadBlob } from "../download";
import { createDocxParagraph } from "./docx-paragraph";
import { getDocumentFileBaseName } from "../export-file-names";

function buildCoverLetterDocx(content: CoverLetterContent): Promise<Blob> {
  const senderName = content.senderName || content.signature || "Your Name";
  const contact = [
    content.senderTitle,
    content.senderEmail,
    content.senderPhone,
    content.senderLocation,
    content.senderWebsite,
  ]
    .filter(Boolean)
    .join(" | ");
  const storedLinks = content.links?.items?.filter((link) => normalizeLinkHref(link.url)) ?? [];
  const linkDisplayMode =
    content.links?.displayMode && content.links.displayMode !== "url"
      ? content.links.displayMode
      : "icon-username";
  const recipient = [
    content.recipientName,
    content.recipientTitle,
    content.companyName,
    content.companyLocation,
  ].filter(Boolean);
  const bodyBlocks = splitRichTextBlocks(content.body);
  const highlights = splitMarkdownLines(content.highlights);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(senderName)],
    }),
  ];

  if (contact) children.push(createDocxParagraph(contact));
  storedLinks.forEach((link) =>
    children.push(createDocxParagraph(getLinkDisplayText(link, linkDisplayMode))),
  );
  if (content.date) children.push(createDocxParagraph(content.date));
  recipient.forEach((line) => children.push(createDocxParagraph(line)));
  if (content.subject || content.jobTitle) {
    children.push(createDocxParagraph(`Subject: ${content.subject || content.jobTitle}`));
  }
  if (content.greeting) children.push(createDocxParagraph(content.greeting));
  if (content.opening) children.push(createDocxParagraph(content.opening));
  bodyBlocks.forEach((block) => {
    if (block.type === "list") {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun(item)],
          }),
        );
      });
      return;
    }

    children.push(createDocxParagraph(block.text));
  });
  highlights.forEach((highlight) => {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(highlight)],
      }),
    );
  });
  if (content.closing) children.push(createDocxParagraph(content.closing));
  children.push(createDocxParagraph(content.signature || senderName));
  if (content.postscript) children.push(createDocxParagraph(`P.S. ${content.postscript}`));

  return Packer.toBlob(
    new Document({
      sections: [{ properties: {}, children }],
    }),
  );
}

export async function exportDocumentAsDocx(document: BaseDocument): Promise<void> {
  const content = document.content as CoverLetterContent;
  const blob = await buildCoverLetterDocx(content);
  downloadBlob(blob, `${getDocumentFileBaseName(document)}.docx`);
}
