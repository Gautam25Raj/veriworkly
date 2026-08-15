/**
 * A page under construction that can be measured after each addition.
 *
 * Implementations own the measuring surface (an off-screen DOM probe for web
 * previews, an accumulated height for weight-based layouts). The contract is
 * append-then-measure so pagination costs one measurement per item rather than
 * one per candidate page.
 */
export interface IncrementalPageProbe<T> {
  /** Adds one item to the page under construction. */
  append(item: T): void;
  /** Whether the page still fits after the most recent {@link append}. */
  fits(): boolean;
  /**
   * Undoes the most recent {@link append}.
   *
   * Must behave as a stack pop: `paginateIncremental` can call this twice in a row
   * (the keep-with-next lookahead appends a probe item, undoes it, and may then undo
   * the real item as well), so an implementation that only remembers a single last
   * append will leave stale content on the page.
   */
  undo(): void;
  /** Discards the page under construction and starts an empty one. */
  reset(): void;
}

/**
 * Splits `items` across pages using one measurement per item.
 *
 * The resume preview previously fitted each section by trying every prefix length —
 * rebuilding the probe's `innerHTML` and reading `scrollHeight` (a forced synchronous
 * reflow) once per candidate length. A section with M items cost O(M²) reflows, and it
 * re-ran on every keystroke.
 *
 * Here each item is appended once and measured once; a page break rewinds a single
 * append. Total reflows are O(items + pages) instead of O(items²).
 *
 * `keepWithNext` prevents widows — return true when `item` must not be the last thing
 * on a page (a section heading immediately followed by its first row, say) and the pair
 * will be required to fit together.
 *
 * An item that cannot fit an empty page is kept on its own page rather than dropped, so
 * oversized content overflows visibly instead of disappearing.
 */
export function paginateIncremental<T>(
  items: T[],
  probe: IncrementalPageProbe<T>,
  keepWithNext?: (item: T, nextItem: T | undefined) => boolean,
): T[][] {
  const pages: T[][] = [];
  let current: T[] = [];

  probe.reset();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const nextItem = items[index + 1];

    probe.append(item);

    let fits = probe.fits();

    if (fits && nextItem && keepWithNext?.(item, nextItem)) {
      probe.append(nextItem);
      fits = probe.fits();
      probe.undo();
    }

    if (fits || current.length === 0) {
      current.push(item);
      continue;
    }

    probe.undo();
    pages.push(current);

    current = [item];
    probe.reset();
    probe.append(item);
  }

  if (current.length > 0) pages.push(current);

  return pages;
}
