import type { IncrementalPageProbe } from "@/templates/shared/pagination";

/**
 * Content bottom must clear the container's bottom padding.
 *
 * `scrollHeight` alone is not enough: a container with bottom padding reports a height
 * that includes it, so an item can visually sit inside the padding while still
 * "fitting". Both cover letter templates checked this; it now lives in one place.
 */
export function fitsInsideBottomPadding(container: HTMLElement, content: HTMLElement) {
  const containerStyle = window.getComputedStyle(container);
  const paddingBottom = Number.parseFloat(containerStyle.paddingBottom) || 0;
  const containerBottom = container.getBoundingClientRect().bottom - paddingBottom;
  const contentBottom = content.getBoundingClientRect().bottom;

  return contentBottom <= containerBottom + 1;
}

export interface CoverLetterProbeConfig<T> {
  /** Element whose height is compared against the page height. */
  measureRoot: HTMLElement;
  /** Element that receives the per-page prefix and the body container. */
  contentRoot: HTMLElement;
  /** Fresh body container for a page (carries the top margin below the prefix). */
  createBody: () => HTMLElement;
  /** Letterhead / rail header for a given page index, or null for none. */
  getPrefix: (pageIndex: number) => HTMLElement | null;
  /** The already-rendered node for an item, cloned into the probe. */
  getItemNode: (item: T) => HTMLElement | null;
  pageHeight: number;
}

/**
 * Append-only measuring probe for cover letter previews.
 *
 * Shared by both templates, which built the identical structure inline. Crucially it is
 * append-only: each item is cloned in once and measured once, where the previous
 * `fitsPage(items[])` callback re-built the whole candidate page from scratch on every
 * measurement. Matches the resume preview's probe (see `ResumePagedPreview.tsx`).
 */
export function createCoverLetterPageProbe<T>(
  config: CoverLetterProbeConfig<T>,
): IncrementalPageProbe<T> {
  let pageIndex = -1;
  let body: HTMLElement | null = null;

  // A stack, not a single slot: `undo()` may be called twice in a row. See
  // IncrementalPageProbe.undo.
  const appended: HTMLElement[] = [];

  return {
    append(item) {
      const node = config.getItemNode(item);
      if (!node || !body) return;

      const clone = node.cloneNode(true) as HTMLElement;
      body.appendChild(clone);
      appended.push(clone);
    },

    fits() {
      if (!body) return true;

      return (
        config.measureRoot.scrollHeight <= config.pageHeight + 1 &&
        fitsInsideBottomPadding(config.measureRoot, body)
      );
    },

    undo() {
      const clone = appended.pop();
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
    },

    reset() {
      pageIndex += 1;
      appended.length = 0;

      config.contentRoot.innerHTML = "";

      const prefix = config.getPrefix(pageIndex);
      if (prefix) config.contentRoot.appendChild(prefix.cloneNode(true));

      body = config.createBody();
      config.contentRoot.appendChild(body);
    },
  };
}
