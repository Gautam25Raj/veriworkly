"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { TYPE } from "@/components/marketing/PageLayout";

import { ENCRYPTION_BOUNDARIES } from "../../data";
import type { DataStop } from "../../types";

/**
 * Pick something you do in VeriWorkly and see every place your text reaches while you do it.
 *
 * Every claim shown here comes from ENCRYPTION_BOUNDARIES, which is the copy we can back up
 * from the repository. The earlier version of this diagram carried its own list of specs
 * (local storage encryption, AES-256, TLS 1.3, a 24h SLA) that the code does not support, so
 * the diagram now has no copy of its own beyond the names of the stops.
 */

const STOPS: { id: DataStop; name: string; where: string }[] = [
  { id: "browser", name: "Your browser", where: "On your device" },
  { id: "api", name: "VeriWorkly API", where: "Our servers" },
  { id: "database", name: "Our database", where: "Our servers" },
  { id: "ai", name: "AI model provider", where: "A named subprocessor" },
  { id: "web", name: "The public web", where: "Anyone with the link" },
];

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export const SecurityBoundaryDiagram = () => {
  const [activeId, setActiveId] = useState(ENCRYPTION_BOUNDARIES[0]!.id);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const active = ENCRYPTION_BOUNDARIES.find((item) => item.id === activeId)!;
  const leavesDevice = active.route.some((stop) => stop !== "browser");

  // Tabs pattern from the ARIA Authoring Practices: arrows move and wrap, Home and End jump.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = ENCRYPTION_BOUNDARIES.length;
    const step = KEY_STEPS[event.key];
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? count - 1
          : step === undefined
            ? null
            : (index + step + count) % count;

    if (next === null) return;
    event.preventDefault();
    setActiveId(ENCRYPTION_BOUNDARIES[next]!.id);
    tabsRef.current[next]?.focus();
  };

  return (
    <div className="bg-background rounded-3xl p-4 sm:p-6 lg:p-8">
      <div
        role="tablist"
        aria-label="What you are doing"
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {ENCRYPTION_BOUNDARIES.map((item, index) => {
          const selected = item.id === activeId;

          return (
            <button
              key={item.id}
              ref={(node) => {
                tabsRef.current[index] = node;
              }}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "focus-visible:ring-accent/40 min-h-12 rounded-full px-5 py-2.5 text-left text-base font-semibold transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
                selected
                  ? "bg-foreground text-background"
                  : "bg-card text-muted hover:text-foreground",
              )}
            >
              {item.action}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="mt-6 lg:mt-8"
      >
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Where your text goes">
          {STOPS.map((stop) => {
            const reached = active.route.includes(stop.id);

            return (
              <li
                key={stop.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors duration-300 sm:min-h-32 sm:flex-col sm:items-start",
                  reached ? "bg-accent text-accent-foreground" : "bg-card text-muted",
                )}
              >
                <span>
                  <span className="block text-base font-semibold">{stop.name}</span>
                  <span className="block text-sm opacity-75">{stop.where}</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {reached ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    <Minus aria-hidden="true" className="size-4" />
                  )}
                  {reached ? "Reached" : "Not touched"}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div>
            <p className="text-muted text-base">
              {leavesDevice ? "Leaves your device" : "Stays on your device"}
            </p>
            <h3 className={`mt-2 text-balance ${TYPE.title}`}>{active.title}</h3>
            <p className="text-muted mt-4 text-base leading-7">{active.description}</p>
          </div>

          <ul className="space-y-3">
            {active.specs.map((spec) => (
              <li key={spec} className="bg-card flex items-start gap-3 rounded-2xl p-4 text-base">
                <Check aria-hidden="true" className="text-success mt-1 size-4 shrink-0" />
                <span>{spec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SecurityBoundaryDiagram;
