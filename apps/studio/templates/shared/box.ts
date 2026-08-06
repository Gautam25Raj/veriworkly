import type { CSSProperties } from "react";

import { pxToPt } from "@/features/resume/constants/resume-layout";

/**
 * A box of a fixed width that neither layout engine may shrink.
 *
 * `flexShrink: 0` alone does **not** work in react-pdf: its layout engine reads
 * the value as `setYogaValue('flexShrink')(value || 1)`, and `0` is falsy, so a
 * declared zero is silently turned into `1` and the box shrinks whenever a
 * sibling's content does not fit. Pinning `minWidth`/`maxWidth` as well is the
 * only reliable way to hold a width, and both engines honour it identically.
 *
 * Used for date gutters, contact columns, bullet markers, icons and rules.
 */
export function webFixedWidth(width: number): CSSProperties {
  return {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: `${width}px`,
    minWidth: `${width}px`,
    width: `${width}px`,
  };
}

export function pdfFixedWidth(width: number) {
  return {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: pxToPt(width),
    minWidth: pxToPt(width),
    width: pxToPt(width),
  } as const;
}

/**
 * A box that may shrink, with no automatic minimum.
 *
 * CSS gives flex items `min-width: auto` (a min-content floor) while Yoga
 * defaults to `0`. Stating `minWidth: 0` removes the difference.
 */
export const webFlexible: CSSProperties = { flexGrow: 1, flexShrink: 1, minWidth: 0 };

export const pdfFlexible = { flexGrow: 1, flexShrink: 1, minWidth: 0 } as const;
