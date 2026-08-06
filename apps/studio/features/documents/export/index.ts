/**
 * Public entry point for document export.
 *
 * Deliberately narrow: it re-exports only the lazy dispatcher and the small
 * side-effect-free helpers. It must never re-export `export-pdf`, `export-docx`,
 * or the per-type handler modules — a barrel that did so is what previously put
 * `@react-pdf/renderer` and `docx` (~2.2MB combined) into the bundle of every
 * route that transitively imported anything from this feature, including the
 * document list and the dashboard overview.
 */
export { exportDocumentByType } from "./export-dispatcher";
export { downloadBlob } from "./download";
export { getDocumentFileBaseName } from "./export-file-names";
