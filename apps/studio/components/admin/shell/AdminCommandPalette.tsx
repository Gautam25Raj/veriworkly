"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { ADMIN_NAV_ROUTES, ADMIN_QUICK_LINKS } from "@/features/admin/config/admin-nav";

interface CommandEntry {
  href: string;
  label: string;
  description: string;
  group: string;
}

const ENTRIES: CommandEntry[] = [
  ...ADMIN_QUICK_LINKS.map((link) => ({
    href: link.href,
    label: link.label,
    description: link.description,
    group: "Quick actions",
  })),
  ...ADMIN_NAV_ROUTES,
];

/**
 * Subsequence match, not substring.
 *
 * Typing "penwd" should find "Pending withdrawals" — an operator reaching for the palette is
 * typing from memory, not reading the list. A plain `includes` would miss that and send them
 * back to the sidebar, which defeats the point of having a palette at all.
 */
function matches(query: string, entry: CommandEntry) {
  const haystack = `${entry.label} ${entry.description} ${entry.group}`.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");

  let cursor = 0;

  for (const character of needle) {
    cursor = haystack.indexOf(character, cursor);
    if (cursor === -1) return false;
    cursor += 1;
  }

  return true;
}

interface AdminCommandPaletteProps {
  /** The palette is mounted only while open, so closing is the only state it reports. */
  onClose: () => void;
}

/**
 * ⌘K / Ctrl+K jump-to for every admin route and queue.
 *
 * Built on plain React rather than a combobox dependency: the behaviour needed here is a
 * filtered list with arrow keys, which is ~40 lines, and the admin already ships no client
 * JS beyond what its mutations require.
 */
const AdminCommandPalette = ({ onClose }: AdminCommandPaletteProps) => {
  const router = useRouter();
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const results = useMemo(
    () => (query.trim() ? ENTRIES.filter((entry) => matches(query.trim(), entry)) : ENTRIES),
    [query],
  );

  /**
   * Clamped during render rather than corrected from an effect.
   *
   * Filtering can leave `highlighted` past the end of a now-shorter list. Fixing that in an
   * effect would render one frame with an out-of-range highlight — briefly highlighting
   * nothing, or the wrong row — before correcting it. Deriving the safe value means the list
   * is never rendered in the inconsistent state at all.
   */
  const activeIndex = Math.min(highlighted, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // The page behind a modal must not scroll under it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((activeIndex + 1) % Math.max(1, results.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((activeIndex - 1 + Math.max(1, results.length)) % Math.max(1, results.length));
      return;
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex].href);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="bg-foreground/25 absolute inset-0 cursor-default backdrop-blur-[2px]"
        onClick={() => onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin command palette"
        className="border-border bg-card relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="border-border flex items-center gap-2.5 border-b px-4">
          <Search className="text-muted h-4 w-4 shrink-0" aria-hidden="true" />

          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page or queue…"
            aria-label="Search admin pages"
            aria-controls="admin-command-results"
            className="text-foreground placeholder:text-muted h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />

          <kbd className="border-border text-muted hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:block">
            ESC
          </kbd>
        </div>

        <ul id="admin-command-results" ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="text-muted px-3 py-8 text-center text-sm">Nothing matches “{query}”.</li>
          ) : (
            results.map((entry, index) => (
              <li key={`${entry.href}-${entry.label}`}>
                <button
                  type="button"
                  data-index={index}
                  onClick={() => go(entry.href)}
                  onMouseMove={() => setHighlighted(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                    index === activeIndex ? "bg-admin-inset" : "",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {entry.label}
                    </span>
                    <span className="text-muted block truncate text-xs">{entry.description}</span>
                  </span>

                  {index === activeIndex ? (
                    <CornerDownLeft
                      className="text-muted h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="text-muted shrink-0 text-[11px]">{entry.group}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default AdminCommandPalette;
