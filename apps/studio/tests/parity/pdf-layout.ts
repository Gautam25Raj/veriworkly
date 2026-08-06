import { join } from "node:path";
import { createRequire } from "node:module";

import { createElement } from "react";
import { Font, pdf } from "@react-pdf/renderer";

import type { ComponentType, ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import type { GeomNode } from "./geometry";

import { FONT_REGISTRY } from "@/features/documents/constants/fonts";
import { registerPdfHyphenation } from "@/templates/pdf/fonts";
import { ptToPx } from "./geometry";

/** The shape `@react-pdf/layout` returns. `top`/`left` are parent-relative. */
export interface LayoutNode {
  type: "DOCUMENT" | "PAGE" | "VIEW" | "TEXT" | "IMAGE" | "LINK" | string;
  box?: { top?: number; left?: number; width?: number; height?: number };
  style?: Record<string, unknown>;
  children?: LayoutNode[];
}

let fontsRegistered = false;

/**
 * Registers the same font files `app/globals.css` declares as `@font-face`, so
 * both engines shape text with one build of each family.
 */
export function registerParityFonts() {
  if (fontsRegistered) return;

  // The same rule the browser export installs, or the measurement is of a
  // document nobody downloads.
  registerPdfHyphenation();

  for (const font of Object.values(FONT_REGISTRY)) {
    Font.register({
      family: font.primaryFamily,
      fonts: font.pdfFonts.map((face) => ({
        src: join(process.cwd(), "public", face.src),
        fontWeight: face.fontWeight,
      })),
    });
  }

  fontsRegistered = true;
}

/** `@react-pdf/layout` is a transitive dependency; resolve it via the renderer. */
function resolveLayoutEngine() {
  const fromHere = createRequire(import.meta.url);
  const fromRenderer = createRequire(fromHere.resolve("@react-pdf/renderer"));

  return fromRenderer("@react-pdf/layout").default as (
    document: LayoutNode,
    fontStore: unknown,
  ) => Promise<LayoutNode>;
}

export async function layoutPages<P extends object>(
  Component: ComponentType<P>,
  props: P,
): Promise<LayoutNode[]> {
  registerParityFonts();

  const element = createElement(Component, props) as unknown as ReactElement<DocumentProps>;
  const instance = pdf(element) as unknown as {
    container: { document: LayoutNode };
    toBuffer: () => Promise<unknown>;
  };

  // The layout engine mutates the tree, so the document must be built first.
  await instance.toBuffer();

  const laidOut = await resolveLayoutEngine()(instance.container.document, Font);
  return laidOut.children ?? [];
}

const px = (node: LayoutNode | undefined) => ({
  top: ptToPx(node?.box?.top),
  left: ptToPx(node?.box?.left),
  width: ptToPx(node?.box?.width),
  height: ptToPx(node?.box?.height),
});

/** A section heading is the only node in a section that declares a bottom margin. */
const isHeading = (node: LayoutNode | undefined) => node?.style?.marginBottom !== undefined;

/**
 * `createResumePdfTemplate` wraps the heading and the first item in an
 * unbreakable group, so a section's first child is that group and a
 * continuation page's first child is a plain item.
 */
const isHeadingGroup = (node: LayoutNode | undefined) => isHeading((node?.children ?? [])[0]);

export interface PdfSection {
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
      const grandChildren = child.children ?? [];

      // The skin header is the first child of the first page and never repeats.
      if (pageIndex === 0 && childIndex === 0 && !isHeadingGroup(grandChildren[0])) {
        header = child;
        return;
      }

      if (isHeadingGroup(grandChildren[0])) {
        const group = grandChildren[0].children ?? [];
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
