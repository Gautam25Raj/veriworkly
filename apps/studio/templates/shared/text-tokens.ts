import type { CSSProperties } from "react";

import { pxToPt } from "@/features/resume/constants/resume-layout";

/**
 * One text recipe shared by the web preview and the PDF export.
 *
 * `lineHeight` is an **absolute pixel height**, not a multiplier, because the
 * two engines inherit line height differently: CSS re-multiplies a unitless
 * factor per element, while react-pdf inherits the already-computed value. An
 * 11.5px caption under a 13px/1.5 page therefore gets a 17.25px line box on
 * the web and a 19.5px one in the PDF unless every node states its own.
 */
export interface TextToken {
  color?: string;
  fontSize: number;
  fontWeight?: 400 | 500 | 600 | 700;
  letterSpacing?: number;
  lineHeight: number;
  textTransform?: "uppercase";
}

/** CSS for a token. Every value is a plain pixel measurement. */
export function webText(token: TextToken): CSSProperties {
  return {
    color: token.color,
    fontSize: `${token.fontSize}px`,
    fontWeight: token.fontWeight,
    letterSpacing: token.letterSpacing ? `${token.letterSpacing}px` : undefined,
    lineHeight: `${token.lineHeight}px`,
    margin: 0,
    textTransform: token.textTransform,
  };
}

/**
 * react-pdf styles for a token. `lineHeight` is a multiplier there, so an
 * absolute box of `L` on a font of size `F` becomes `L / F`; multiplied by the
 * point font size that lands on exactly `pxToPt(L)` — the web's line box.
 */
export function pdfText(token: TextToken) {
  return {
    color: token.color,
    fontSize: pxToPt(token.fontSize),
    fontWeight: token.fontWeight,
    letterSpacing: pxToPt(token.letterSpacing ?? 0),
    lineHeight: token.lineHeight / token.fontSize,
    textTransform: token.textTransform,
  } as const;
}
