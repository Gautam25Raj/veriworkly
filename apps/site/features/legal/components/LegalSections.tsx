"use client";

import { useMemo, useState } from "react";

import { cn } from "@veriworkly/ui";

import { FRAME } from "@/components/marketing/PageLayout";

import type { LegalSection } from "../types";

import { useScrollSpy } from "../hooks/useScrollSpy";
import { useLegalSearch } from "../hooks/useLegalSearch";

import { LegalMobileNav } from "./LegalMobileNav";
import { LegalSidebarTOC } from "./LegalSidebarTOC";
import { LegalSectionCard } from "./LegalSectionCard";

export interface LegalSectionsProps {
  sections: LegalSection[];
}

export function LegalSections({ sections }: LegalSectionsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

  const activeSectionId = useScrollSpy(sectionIds);
  const filteredSections = useLegalSearch(sections, searchQuery);

  return (
    <section aria-label="Full text" className="py-16 lg:py-24">
      <div
        className={cn(
          FRAME,
          "lg:grid lg:grid-cols-[minmax(0,18.5rem)_minmax(0,42rem)] lg:items-start lg:justify-between lg:gap-16",
        )}
      >
        <LegalMobileNav
          sections={sections}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeSectionId={activeSectionId}
          filteredSections={filteredSections}
        />

        <LegalSidebarTOC
          sections={sections}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeSectionId={activeSectionId}
          filteredSections={filteredSections}
        />

        {/* Not <main>: AppShell already renders the page-level main landmark around
            every marketing page, and two "main" regions make landmark navigation
            ambiguous for screen-reader users - on exactly the two pages that most
            need to be navigable. */}
        <div className="min-w-0 space-y-16 lg:space-y-20">
          {filteredSections.length === 0 ? (
            <div className="bg-card rounded-3xl px-6 py-14 text-center">
              <p className="text-xl font-bold tracking-tight">
                No clauses mention &ldquo;{searchQuery}&rdquo;
              </p>

              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-accent focus-visible:ring-accent/40 mt-3 cursor-pointer rounded-full text-base font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Show the whole document
              </button>
            </div>
          ) : (
            filteredSections.map((section) => (
              <LegalSectionCard
                key={section.id}
                section={section}
                displayIndex={sections.findIndex((s) => s.id === section.id) + 1}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default LegalSections;
