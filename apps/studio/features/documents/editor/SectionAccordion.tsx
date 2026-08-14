"use client";

import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Collapsible section used by every document editor's content and design panels.
 *
 * Lives in `features/documents` because both editors use it — the cover letter panel
 * previously reached into `features/resume/editor/content/SectionAccordion`, and the
 * design panel had a third, separately-written copy of the same disclosure.
 *
 * The `aria-expanded`/`aria-controls` pairing and the `role="region"` panel are what make
 * this announce correctly; without them a screen reader reads 15+ identical unlabelled
 * buttons with no indication of open state.
 */
const SectionAccordion = ({
  children,
  id,
  isOpen,
  label,
  onToggle,
}: {
  children: ReactNode;
  id: string;
  isOpen: boolean;
  label: string;
  onToggle: (id: string) => void;
}) => {
  const panelId = `section-accordion-panel-${id}`;
  const buttonId = `section-accordion-button-${id}`;

  return (
    <div className="border-border bg-background/70 overflow-hidden border-b transition last:border-b-0">
      <button
        type="button"
        id={buttonId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between px-3 py-3 text-left text-sm font-semibold transition",
          isOpen ? "bg-card text-foreground" : "text-muted hover:bg-card hover:text-foreground",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>

        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 transition", isOpen ? "rotate-180" : "")}
        />
      </button>

      {/*
        Kept mounted-when-open rather than hidden-when-closed: the panels hold live
        form state, and `hidden` content stays in the accessibility tree as focusable
        fields the user cannot see.
      */}
      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="bg-card border-border/70 border-t p-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default SectionAccordion;
