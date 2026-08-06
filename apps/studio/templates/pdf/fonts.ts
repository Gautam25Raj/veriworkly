import { Font } from "@react-pdf/renderer";

import type { ResumeData } from "@/types/resume";

import { getResumeRenderStyle } from "@/features/documents/rendering/resume-rendering";
import { getPdfFontEntries } from "@/features/documents/constants/fonts";

const registeredFonts = new Set<string>();
let hasRegisteredHyphenation = false;

/**
 * Mirrors the preview's `overflow-wrap: anywhere` (see `.resume-page-preview`
 * in globals.css) as closely as react-pdf allows.
 *
 * The previous rule chopped every word longer than 18 characters into 12
 * character pieces, so a 20 character word broke in the PDF while CSS moved it
 * to the next line intact — a wrapping difference between preview and export.
 * Words short enough to fit a column are now left whole, and genuinely
 * oversized tokens (long URLs) get a break opportunity at every character,
 * which is what `anywhere` does once a word cannot fit on a line by itself.
 */
const MAX_UNBREAKABLE_WORD_LENGTH = 60;

/**
 * Turns react-pdf's hyphenation off, which is what CSS does by default.
 *
 * Exported and free of the `window` guard on purpose: react-pdf hyphenates
 * eagerly ("doc-ument", "de-tails") unless told not to, and the preview never
 * will, so anything that lays out a PDF has to install this — including tests.
 * While it lived inside the browser-only registration path, every Node-side
 * check measured a document that broke its lines differently from the one users
 * actually download.
 */
export function registerPdfHyphenation() {
  if (hasRegisteredHyphenation) return;

  Font.registerHyphenationCallback((word) =>
    word.length <= MAX_UNBREAKABLE_WORD_LENGTH ? [word] : Array.from(word),
  );

  hasRegisteredHyphenation = true;
}

export function registerPdfFont(resume: ResumeData) {
  if (typeof window === "undefined") return;

  const fontId = getResumeRenderStyle(resume).fontFamily;
  registerPdfFontById(fontId);
}

export function registerPdfFontById(fontFamily: string | null | undefined) {
  if (typeof window === "undefined") return;

  registerPdfHyphenation();

  // The fallbacks too, or the stack `getPdfFontStack` returns names families
  // react-pdf has never heard of and it quietly draws nothing for any character
  // the chosen family lacks.
  for (const font of getPdfFontEntries(fontFamily)) {
    if (registeredFonts.has(font.id)) continue;

    Font.register({
      family: font.primaryFamily,
      fonts: font.pdfFonts.map((face) => ({
        src: new URL(face.src, window.location.origin).toString(),
        fontWeight: face.fontWeight,
      })),
    });

    registeredFonts.add(font.id);
  }
}
