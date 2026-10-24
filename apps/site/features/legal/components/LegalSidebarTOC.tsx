"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Search, X } from "lucide-react";

import { cn } from "@veriworkly/ui";

import type { LegalSection } from "../types";

interface LegalSidebarTOCProps {
  sections: LegalSection[];
  filteredSections: LegalSection[];
  activeSectionId: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function LegalSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (query: string) => void;
}) {
  return (
    <div className="bg-background focus-within:ring-accent/40 flex h-11 shrink-0 items-center gap-3 rounded-full px-4 transition-shadow focus-within:ring-2">
      <Search aria-hidden="true" className="text-muted size-4 shrink-0" />

      <input
        type="search"
        value={value}
        aria-label="Search this document"
        placeholder="Search clauses"
        onChange={(e) => onChange(e.target.value)}
        className="text-foreground placeholder:text-muted w-full min-w-0 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
      />

      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="text-muted hover:text-foreground focus-visible:ring-accent/40 -mr-1.5 cursor-pointer rounded-full p-1.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

export function LegalTocLinks({
  sections,
  filteredSections,
  activeSectionId,
  onNavigate,
}: Pick<LegalSidebarTOCProps, "sections" | "filteredSections" | "activeSectionId"> & {
  onNavigate?: () => void;
}) {
  return (
    <ol className="space-y-0.5">
      {filteredSections.map((section) => {
        const isActive = activeSectionId === section.id;

        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={onNavigate}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "focus-visible:ring-accent/40 flex gap-3 rounded-xl px-3 py-2 text-base leading-6 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none",
                isActive
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <span className="w-5 shrink-0 tabular-nums opacity-70">
                {sections.findIndex((s) => s.id === section.id) + 1}
              </span>
              <span>{section.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function LegalSidebarTOC({
  sections,
  filteredSections,
  activeSectionId,
  searchQuery,
  onSearchChange,
}: LegalSidebarTOCProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!activeSectionId || !navRef.current) return;

    const activeLink = navRef.current.querySelector<HTMLElement>(`a[href="#${activeSectionId}"]`);

    // `nearest` keeps the index from jumping; `instant` avoids fighting the page's own smooth scroll.
    activeLink?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [activeSectionId]);

  return (
    <aside className="bg-card hidden rounded-3xl p-4 lg:sticky lg:top-28 lg:flex lg:max-h-[calc(100dvh-8.5rem)] lg:flex-col">
      <h2 className="shrink-0 px-3 pt-2 pb-4 text-base font-semibold">
        Contents <span className="text-muted font-normal tabular-nums">({sections.length})</span>
      </h2>

      <LegalSearchField value={searchQuery} onChange={onSearchChange} />

      <nav
        ref={navRef}
        aria-label="Table of contents"
        className="hide-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto"
      >
        <LegalTocLinks
          sections={sections}
          filteredSections={filteredSections}
          activeSectionId={activeSectionId}
        />
      </nav>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0 })}
        className="text-muted hover:text-foreground focus-visible:ring-accent/40 mt-3 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowUp aria-hidden="true" className="size-4" />
        Back to top
      </button>
    </aside>
  );
}
