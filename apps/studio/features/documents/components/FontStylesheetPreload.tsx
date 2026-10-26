/**
 * The editor preview renders with local `@font-face` rules in `app/globals.css` that point
 * at the same files the PDF embeds (only an exported cover-letter HTML file links Google
 * Fonts). Preloading the default family keeps the first measurement of the paged preview
 * from running against a fallback face.
 */
const DOCUMENT_FONT_FILES = [
  "/fonts/geist/Geist-Regular.ttf",
  "/fonts/geist/Geist-Bold.ttf",
] as const;

export function FontStylesheetPreload() {
  return (
    <>
      {DOCUMENT_FONT_FILES.map((href) => (
        <link as="font" crossOrigin="" href={href} key={href} rel="preload" type="font/ttf" />
      ))}
    </>
  );
}
