/**
 * The header shared by the stacked skins: name, then headline, then contact and link rows,
 * closed by a bottom rule.
 *
 * Name and headline are stacked, never side by side: text extractors read glyphs sharing a
 * baseline as one line, so a headline beside the name became part of it and the ATS lost
 * the name.
 */
export interface StackedHeaderOptions {
  /** CSS pixels, read identically by the web and PDF renderers. */
  geometry: {
    headerGap: number;
    headerPadBottom: number;
    nameGapY: number;
    contactTop: number;
    linksTop: number;
  };
  /** The bottom rule's thickness in hairlines. Defaults to 1. */
  ruleWeight?: number;
  /** Which style colour draws the bottom rule. Defaults to the border colour. */
  ruleColor?: "borderColor" | "accentColor";
  /** Overrides the role token's weight for the headline. */
  headlineWeight?: number;
}
