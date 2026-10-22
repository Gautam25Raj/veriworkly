import type { ExportFormatItem } from "../types";

export const EXPORT_FORMATS: ExportFormatItem[] = [
  {
    ext: "pdf",
    name: "Vector PDF",
    desc: "Compiled in your browser, with selectable text and embedded fonts.",
  },
  {
    ext: "docx",
    name: "Microsoft Word",
    desc: "Native Word format for recruiters and agency portals.",
  },
  {
    ext: "md",
    name: "Markdown",
    desc: "Structured plain text for developer portfolios and READMEs.",
  },
  {
    ext: "html",
    name: "Clean HTML",
    desc: "A standalone, semantic web page ready to embed anywhere.",
  },
  {
    ext: "json",
    name: "JSON",
    desc: "A portable backup of your career data in an open schema.",
  },
  {
    ext: "txt",
    name: "Plain text",
    desc: "A clean text stream for older application forms.",
  },
];
