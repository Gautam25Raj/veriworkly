"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@veriworkly/ui";

import type { LegalSection } from "../types";

import { LegalSearchField, LegalTocLinks } from "./LegalSidebarTOC";

interface LegalMobileNavProps {
  sections: LegalSection[];
  filteredSections: LegalSection[];
  activeSectionId: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function LegalMobileNav({
  sections,
  filteredSections,
  activeSectionId,
  searchQuery,
  onSearchChange,
}: LegalMobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const currentIndex = sections.findIndex((s) => s.id === activeSectionId);
  const currentSection = sections[currentIndex];

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sticky top-20 z-30 mb-12 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="bg-foreground text-background focus-visible:ring-accent/40 flex h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-5 text-left text-base font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1 truncate">
          {currentSection ? (
            <>
              <span className="mr-2 tabular-nums opacity-70">{currentIndex + 1}.</span>
              {currentSection.title}
            </>
          ) : (
            "Contents"
          )}
        </span>
        <span className="text-sm font-medium opacity-70">Contents</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="bg-card animate-scale-in ring-foreground/10 absolute inset-x-0 top-full mt-2 max-h-[min(28rem,70dvh)] origin-top overflow-y-auto rounded-2xl p-3 shadow-xl ring-1"
        >
          <LegalSearchField value={searchQuery} onChange={onSearchChange} />

          <nav aria-label="Table of contents" className="mt-3">
            <LegalTocLinks
              sections={sections}
              filteredSections={filteredSections}
              activeSectionId={activeSectionId}
              onNavigate={() => setOpen(false)}
            />
          </nav>
        </div>
      )}
    </div>
  );
}
