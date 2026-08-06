/**
 * Document fonts are declared as local `@font-face` rules in `app/globals.css`,
 * pointing at the same files `templates/pdf/fonts.ts` embeds in the PDF. Loading
 * them from Google Fonts here as well would let the browser pick a different
 * build of the family than the export uses, which changes advance widths and
 * therefore where lines wrap.
 *
 * The standalone HTML export still links Google Fonts — it has no access to
 * /public/fonts — via `getFontStylesheetHref`.
 */
export function DocumentFontLoader(): null {
  return null;
}
