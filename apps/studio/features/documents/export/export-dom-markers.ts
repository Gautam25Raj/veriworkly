/**
 * DOM markers the WYSIWYG ("export what is on screen") HTML export keys off.
 *
 * They live in their own dependency-free module so a preview component can carry them
 * without importing `export-html.ts` — and, through it, the export barrel that pulls in
 * `@react-pdf/renderer` and `docx`.
 */

/**
 * Marks the element that wraps the *visible* rendered document and nothing else.
 *
 * The preview stage also contains the off-screen copy the paginator measures against;
 * exporting the whole stage would carry a second, complete copy of the resume — invisible in
 * a browser, fully present to anything that parses the markup (an ATS, a text extractor).
 */
export const EXPORT_ROOT_ATTRIBUTE = "data-resume-pages";

/**
 * Marks a subtree that exists only to be measured or laid out and must never be exported,
 * regardless of how the preview's DOM is restructured later.
 */
export const EXPORT_EXCLUDE_ATTRIBUTE = "data-export-exclude";
