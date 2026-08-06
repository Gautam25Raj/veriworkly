import type { ResumeRenderStyle } from "@/features/documents/rendering/resume-rendering";
import type { TextToken } from "@/templates/shared/text-tokens";
import type { ResumeTypeScale } from "./typography";

export { webText } from "@/templates/shared/text-tokens";
export type { TextToken as ResumeTextToken } from "@/templates/shared/text-tokens";

export interface ResumeTokens {
  name: TextToken;
  role: TextToken;
  contact: TextToken;
  sectionTitle: TextToken;
  itemTitle: TextToken;
  /** Right-hand meta in an item head; shares the title's line box. */
  headMeta: TextToken;
  /** Dates in the gutter layout; shares the title's line box. */
  gutterMeta: TextToken;
  /** Company / school / tech-stack line under a title. */
  subtitle: TextToken;
  body: TextToken;
}

/**
 * Text recipes for one template, in CSS pixels.
 *
 * See `templates/shared/text-tokens.ts` for why every line height is absolute:
 * CSS re-multiplies a unitless factor per element while react-pdf inherits the
 * computed value, so an 11.5px caption under a 13px/1.5 page would otherwise be
 * 17.25px tall in the preview and 19.5px in the export.
 */
export function createResumeTokens(style: ResumeRenderStyle, scale: ResumeTypeScale): ResumeTokens {
  const heading = style.headingLineHeight;
  const bodyLineHeight = style.bodyLineHeight;

  // The item head keeps the title and its meta in line boxes of the same
  // height, so both engines place them identically without relying on either
  // one's baseline-alignment implementation — react-pdf resolves "baseline" to
  // the box bottom, which is not what CSS does.
  const headLineHeight = scale.itemTitle * heading;

  return {
    name: {
      color: style.accentColor,
      fontSize: scale.name,
      fontWeight: 700,
      letterSpacing: scale.nameTracking,
      lineHeight: scale.name * heading,
    },
    role: {
      color: style.mutedTextColor,
      fontSize: scale.role,
      fontWeight: 700,
      letterSpacing: scale.roleTracking,
      lineHeight: scale.role * heading,
    },
    contact: {
      color: style.mutedTextColor,
      fontSize: scale.contact,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: scale.contact * bodyLineHeight,
    },
    sectionTitle: {
      color: style.accentColor,
      fontSize: scale.sectionTitle,
      fontWeight: 700,
      letterSpacing: scale.sectionTitleTracking,
      lineHeight: scale.sectionTitle * heading,
    },
    itemTitle: {
      color: style.sectionHeadingColor,
      fontSize: scale.itemTitle,
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: headLineHeight,
    },
    headMeta: {
      color: style.mutedTextColor,
      fontSize: scale.meta,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: headLineHeight,
    },
    gutterMeta: {
      color: style.mutedTextColor,
      fontSize: scale.meta,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: headLineHeight,
    },
    subtitle: {
      color: style.mutedTextColor,
      fontSize: scale.meta,
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: scale.meta * bodyLineHeight,
    },
    body: {
      color: style.textColor,
      fontSize: scale.body,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: scale.body * bodyLineHeight,
    },
  };
}
