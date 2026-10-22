"use client";

import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <nav aria-label="Scan progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {steps.map((label, index) => {
          const state = index < current ? "done" : index === current ? "active" : "upcoming";
          return (
            <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    state === "done"
                      ? "bg-accent text-accent-foreground"
                      : state === "active"
                        ? "bg-foreground text-background"
                        : "bg-card text-muted"
                  }`}
                  aria-hidden="true"
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  aria-current={state === "active" ? "step" : undefined}
                  className={`hidden text-base font-semibold sm:inline ${
                    state === "upcoming" ? "text-muted" : "text-foreground"
                  }`}
                >
                  {label}
                  <span className="sr-only">
                    {state === "done"
                      ? " (completed)"
                      : state === "active"
                        ? " (current step)"
                        : ""}
                  </span>
                </span>
              </div>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 transition-colors ${
                    state === "done" ? "bg-accent" : "bg-border"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Stepper;
