/**
 * One normalized geometry record, produced identically from the browser's box
 * tree and from react-pdf's layout tree so the two can be diffed directly.
 *
 * `top`/`left` are relative to the parent's border box — Yoga reports child
 * positions that way, and `getBoundingClientRect()` deltas do too — which keeps
 * the records free of the absolute offsets pagination introduces.
 */
export interface GeomNode {
  path: string;
  kind: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export const PT_PER_PX = 0.75;

/** react-pdf works in points; every record is normalized back to CSS pixels. */
export const ptToPx = (value = 0) => Number((value / PT_PER_PX).toFixed(3));

export interface GeomDiff {
  path: string;
  kind: string;
  field: "top" | "left" | "width" | "height";
  web: number;
  pdf: number;
  delta: number;
}

/**
 * Compares two record sets and returns every field that moved by more than
 * `tolerance` CSS pixels, plus every record only one engine produced.
 */
export function diffGeometry(
  web: GeomNode[],
  pdf: GeomNode[],
  tolerance: number,
): { diffs: GeomDiff[]; onlyWeb: string[]; onlyPdf: string[] } {
  const webByPath = new Map(web.map((node) => [node.path, node]));
  const pdfByPath = new Map(pdf.map((node) => [node.path, node]));

  const diffs: GeomDiff[] = [];

  for (const webNode of web) {
    const pdfNode = pdfByPath.get(webNode.path);
    if (!pdfNode) continue;

    for (const field of ["top", "left", "width", "height"] as const) {
      const delta = webNode[field] - pdfNode[field];

      if (Math.abs(delta) > tolerance) {
        diffs.push({
          path: webNode.path,
          kind: webNode.kind,
          field,
          web: webNode[field],
          pdf: pdfNode[field],
          delta: Number(delta.toFixed(3)),
        });
      }
    }
  }

  return {
    diffs,
    onlyWeb: web.filter((node) => !pdfByPath.has(node.path)).map((node) => node.path),
    onlyPdf: pdf.filter((node) => !webByPath.has(node.path)).map((node) => node.path),
  };
}

export function formatDiffs(
  label: string,
  result: { diffs: GeomDiff[]; onlyWeb: string[]; onlyPdf: string[] },
  limit = 40,
): string {
  const lines: string[] = [];

  for (const diff of result.diffs.slice(0, limit)) {
    lines.push(
      `${label} ${diff.path} (${diff.kind}) ${diff.field}: web ${diff.web} vs pdf ${diff.pdf} (${
        diff.delta > 0 ? "+" : ""
      }${diff.delta}px)`,
    );
  }

  if (result.diffs.length > limit) {
    lines.push(`${label} ... and ${result.diffs.length - limit} more box differences`);
  }

  for (const path of result.onlyWeb.slice(0, limit)) {
    lines.push(`${label} ${path}: present in the preview, missing from the PDF`);
  }

  for (const path of result.onlyPdf.slice(0, limit)) {
    lines.push(`${label} ${path}: present in the PDF, missing from the preview`);
  }

  return lines.join("\n");
}
