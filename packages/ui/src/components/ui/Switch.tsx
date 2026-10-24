"use client";

import * as React from "react";

import { cn } from "../../utils";

export interface SwitchProps extends Omit<
  React.ComponentProps<"input">,
  "type" | "checked" | "onChange" | "children"
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ className, checked, onCheckedChange, disabled, ...props }: SwitchProps) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out",
        "has-focus-visible:ring-accent has-focus-visible:ring-offset-background has-focus-visible:ring-2 has-focus-visible:ring-offset-2",
        "forced-colors:border-[ButtonBorder]",
        checked ? "bg-accent forced-colors:bg-[Highlight]" : "bg-muted/80",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="absolute inset-0 m-0 size-full cursor-[inherit] appearance-none rounded-full opacity-0"
        {...props}
      />

      <span
        aria-hidden="true"
        className={cn(
          "bg-background pointer-events-none block size-5 rounded-full shadow-md transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "forced-colors:border forced-colors:border-[ButtonText]",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </span>
  );
}
