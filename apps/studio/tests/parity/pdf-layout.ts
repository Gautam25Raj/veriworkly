import type { GeomNode } from "./geometry";
import type { LayoutNode } from "@/tests/utils/pdf";

import { ptToPx } from "./geometry";

export { layoutPages, type LayoutNode } from "@/tests/utils/pdf";

const px = (node: LayoutNode | undefined) => ({
  top: ptToPx(node?.box?.top),
  left: ptToPx(node?.box?.left),
  width: ptToPx(node?.box?.width),
  height: ptToPx(node?.box?.height),
});

/**
 * Children that take up space. A section that flows opens with an empty view so its
 * heading can carry `minPresenceAhead`; that view is not part of the document.
 */
const drawn = (nodes: LayoutNode[] | undefined) =>
  (nodes ?? []).filter((node) => (node.box?.height ?? 0) > 0);

/**
 * A section heading is the only node in a section that declares a bottom margin. A part of
 * a paragraph react-pdf broke across pages declares one too, of zero, so zero does not count.
 */
const isHeading = (node: LayoutNode | undefined) => Number(node?.style?.marginBottom ?? 0) > 0;

/**
 * `createResumePdfTemplate` wraps the heading and the first item in an
 * unbreakable group, so a section's first child is that group and a
 * continuation page's first child is a plain item.
 */
const isHeadingGroup = (node: LayoutNode | undefined) => isHeading(drawn(node?.children)[0]);

interface PdfSection {
  heading: LayoutNode;
  items: LayoutNode[];
  /** How many page boxes the section occupies; >1 means react-pdf broke it. */
  partCount: number;
  /**
   * True when the break falls straight after the heading, leaving the title
   * alone at the foot of a page with every item overleaf.
   */
  strandedHeading: boolean;
}

export interface PdfDocumentShape {
  pageCount: number;
  pageBox: { width: number; height: number };
  header?: LayoutNode;
  sections: PdfSection[];
  /** Number of top-level blocks react-pdf placed on each page. */
  blocksPerPage: number[];
}

/**
 * Rebuilds one logical document from the per-page layout trees: a section that
 * flows across a break appears once per page, and only the first of those parts
 * carries the heading.
 */
export function readResumeDocument(pages: LayoutNode[]): PdfDocumentShape {
  const sections: PdfSection[] = [];
  let header: LayoutNode | undefined;

  pages.forEach((page, pageIndex) => {
    (page.children ?? []).forEach((child, childIndex) => {
      // What a flowing section leaves behind when its heading moved on: nothing drawn.
      if ((child.box?.height ?? 0) === 0) return;

      const grandChildren = child.children ?? [];

      // The skin header is the first child of the first page and never repeats.
      if (pageIndex === 0 && childIndex === 0 && !isHeadingGroup(grandChildren[0])) {
        header = child;
        return;
      }

      if (isHeadingGroup(grandChildren[0])) {
        const group = drawn(grandChildren[0].children);
        const kept = [...group.slice(1), ...grandChildren.slice(1)].filter(
          (node) => (node.box?.height ?? 0) > 0,
        );

        sections.push({
          heading: group[0],
          items: kept,
          partCount: 1,
          // Recorded on the way in: if the heading's own group carries no item,
          // the title was left alone at the foot of the page.
          strandedHeading: group.length === 1,
        });
        return;
      }

      const previous = sections[sections.length - 1];
      if (!previous) return;

      // Splitting a section leaves an empty stub of the item that moved: a box
      // of zero height that draws nothing. The preview has no equivalent, and
      // counting it would shift every later item's index by one.
      previous.items.push(...grandChildren.filter((node) => (node.box?.height ?? 0) > 0));
      previous.partCount += 1;
    });
  });

  return {
    pageCount: pages.length,
    pageBox: { width: ptToPx(pages[0]?.box?.width), height: ptToPx(pages[0]?.box?.height) },
    header,
    sections,
    blocksPerPage: pages.map((page) => (page.children ?? []).length),
  };
}

export const splitSectionIndexes = (shape: PdfDocumentShape) =>
  shape.sections.flatMap((section, index) => (section.partCount > 1 ? [index] : []));

/**
 * Flattens a laid-out resume into comparable records.
 *
 * Offsets inside a section that react-pdf had to break are dropped: they restart
 * at every page boundary, so only sizes are meaningful there. The pagination
 * test covers the flow those sections take.
 */
export function describeResumePdf(
  shape: PdfDocumentShape,
  layout: "stacked" | "gutter",
): GeomNode[] {
  const out: GeomNode[] = [];

  const emit = (path: string, kind: string, node: LayoutNode | undefined, offsets = true) => {
    if (!node) return;

    const b = px(node);
    out.push({
      path,
      kind,
      top: offsets ? b.top : 0,
      left: offsets ? b.left : 0,
      width: b.width,
      height: b.height,
    });
  };

  if (shape.header) emit("header", "header", shape.header, false);

  shape.sections.forEach((section, sectionIndex) => {
    const base = `section[${sectionIndex}]`;
    const offsets = section.partCount === 1;

    emit(`${base}.heading`, "heading", section.heading, offsets);

    section.items.forEach((item, itemIndex) => {
      const itemPath = `${base}.item[${itemIndex}]`;

      emit(itemPath, "item", item, offsets);

      if (item.type !== "VIEW") return;

      const children = item.children ?? [];
      let rows = children;

      if (layout === "gutter") {
        if (children.length !== 2) return;

        emit(`${itemPath}.gutter`, "gutter", children[0], offsets);
        emit(`${itemPath}.body`, "body", children[1], offsets);
        rows = children[1].children ?? [];
      }

      rows.forEach((row, rowIndex) => {
        const rowPath = `${itemPath}.row[${rowIndex}]`;
        emit(rowPath, "row", row, offsets);

        const rowChildren = row.children ?? [];

        // A bullet block is a list of [markerColumn, text] rows; a head row is
        // [title, meta?]. Everything else is a paragraph with no inner boxes.
        const isBulletBlock =
          rowChildren.length > 0 &&
          rowChildren.every(
            (child) =>
              child.type === "VIEW" &&
              (child.children ?? []).length === 2 &&
              (child.children ?? [])[0]?.type === "VIEW",
          );

        if (isBulletBlock) {
          rowChildren.forEach((bullet, bulletIndex) => {
            const bulletPath = `${rowPath}.bullet[${bulletIndex}]`;

            emit(bulletPath, "bullet", bullet, offsets);

            const [marker, text] = bullet.children ?? [];
            emit(`${bulletPath}.marker`, "marker", marker, offsets);
            emit(`${bulletPath}.text`, "text", text, offsets);
          });
          return;
        }

        if (row.type === "VIEW" && rowChildren.length > 0 && rowChildren.length <= 2) {
          rowChildren.forEach((cell, cellIndex) => {
            emit(
              `${rowPath}.cell[${cellIndex}]`,
              cellIndex === 0 ? "title" : "meta",
              cell,
              offsets,
            );
          });
        }
      });
    });
  });

  return out;
}
