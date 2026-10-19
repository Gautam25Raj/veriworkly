"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { siteConfig } from "@/config/site";
import { SURFACES as surfaces } from "../data/content";
import { CopyCommand } from "./CopyCommand";

/**
 * The four ways to run the engine, one tab each, with the code to start. Reads its data itself:
 * the surfaces carry icon components, which cannot be passed from a server component.
 */
export function CodeTabs() {
  const [activeId, setActiveId] = useState(surfaces[0]?.id);
  const active = surfaces.find((surface) => surface.id === activeId) ?? surfaces[0];

  if (!active) return null;

  return (
    <div className="border-border/60 bg-card/40 overflow-hidden rounded-3xl border backdrop-blur-sm">
      <div
        role="tablist"
        aria-label="Ways to run the engine"
        className="border-border/60 flex gap-1 overflow-x-auto border-b p-2"
      >
        {surfaces.map((surface) => {
          const Icon = surface.icon;
          const selected = surface.id === active.id;

          return (
            <button
              key={surface.id}
              type="button"
              role="tab"
              id={`surface-tab-${surface.id}`}
              aria-selected={selected}
              aria-controls={`surface-panel-${surface.id}`}
              onClick={() => setActiveId(surface.id)}
              className={`focus-visible:ring-accent inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:text-sm ${
                selected
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground hover:bg-background"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {surface.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`surface-panel-${active.id}`}
        aria-labelledby={`surface-tab-${active.id}`}
        className="grid gap-6 p-6 lg:grid-cols-5 lg:gap-8"
      >
        <div className="min-w-0 space-y-3 lg:col-span-2">
          <h3 className="text-foreground text-lg font-semibold tracking-tight">{active.title}</h3>
          <p className="text-muted text-sm leading-relaxed">{active.body}</p>
          <a
            href={`${siteConfig.links.docs}${active.docsPath}`}
            className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            Read the {active.label} guide
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          {active.id === "library" ? (
            <div className="pt-2">
              <CopyCommand command="npm install @veriworkly/ats-engine" />
            </div>
          ) : null}
        </div>

        <pre
          tabIndex={0}
          aria-label={`${active.label} example`}
          className="border-border/60 bg-background text-foreground focus-visible:ring-accent min-w-0 overflow-x-auto rounded-2xl border p-5 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:outline-none sm:text-[13px] lg:col-span-3"
        >
          <code>{active.code}</code>
        </pre>
      </div>
    </div>
  );
}

export default CodeTabs;
