import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";

import type { ComponentType, ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import { extractResume } from "@veriworkly/ats-engine/node";

import type { CoverLetterContent } from "@/features/cover-letter/types";

import { createDefaultCoverLetter } from "@/features/cover-letter/defaults";
import { defaultResume } from "@/features/resume/constants/default-resume";
import { coverLetterTemplateRegistry } from "@/templates/cover-letter/registry";
import { loadTemplatePdfComponentById, pdfTemplateIds } from "@/templates/resume/pdf";
import { registerPdfTestFonts } from "@/tests/utils/pdf";

/**
 * The browser registers PDF fonts from URLs (templates/pdf/fonts.ts). Under
 * Node we register the same faces from disk so the export path is exercised
 * end to end instead of silently falling back to Helvetica.
 */
/**
 * Template components render a `<Document>` but declare their own props, which
 * `renderToBuffer` cannot infer. The cast is confined to this helper.
 */
function pdfElement<P extends object>(
  Template: ComponentType<P>,
  props: P,
): ReactElement<DocumentProps> {
  return createElement(Template, props) as unknown as ReactElement<DocumentProps>;
}

beforeAll(() => {
  registerPdfTestFonts();
});

describe("resume pdf export contract", () => {
  const resumeWithCredential = {
    ...defaultResume,
    certificates: [
      {
        id: "cert-1",
        title: "AWS Certified Developer",
        issuer: "Amazon Web Services",
        date: "2024-05",
        website: "https://verify.example.com/aws-cert",
        showLink: true,
        referenceId: "CRED-99182",
        description: "Associate level certification.",
      },
    ],
  };

  for (const templateId of pdfTemplateIds) {
    it(`S-037: renders a real PDF for ${templateId}, credential included`, async () => {
      const TemplatePdf = await loadTemplatePdfComponentById(templateId);
      const buffer = await renderToBuffer(
        pdfElement(TemplatePdf, { resume: { ...resumeWithCredential, templateId } }),
      );
      const { text } = await extractResume(buffer, "pdf");

      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      // Read back, so a fixture that renders nothing cannot pass.
      expect(text).toContain("AWS Certified Developer");
      expect(text).toContain("CRED-99182");
      expect(text).toContain("Associate level certification.");
    }, 30_000);
  }
});

describe("cover letter pdf export contract", () => {
  function createContent(
    overrides: Partial<CoverLetterContent["appearance"]> = {},
  ): CoverLetterContent {
    const base = createDefaultCoverLetter("cover-letter-pdf-contract").content;

    return { ...base, appearance: { ...base.appearance, ...overrides } };
  }

  for (const templateId of coverLetterTemplateRegistry.ids) {
    it(`renders a real PDF for ${templateId}`, async () => {
      const CoverLetterPdf = await coverLetterTemplateRegistry.loadPdf(templateId);
      const buffer = await renderToBuffer(pdfElement(CoverLetterPdf, { content: createContent() }));

      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.byteLength).toBeGreaterThan(5_000);
    }, 30_000);

    it(`renders ${templateId} with an inverted colour scheme`, async () => {
      const CoverLetterPdf = await coverLetterTemplateRegistry.loadPdf(templateId);
      const buffer = await renderToBuffer(
        pdfElement(CoverLetterPdf, {
          content: createContent({
            textColor: "#f8fafc",
            pageColor: "#0b1220",
            sidebarColor: "#020617",
            accentColor: "#f97316",
          }),
        }),
      );

      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    }, 30_000);
  }
});
