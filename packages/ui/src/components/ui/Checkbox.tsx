"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "../../utils";

export function checkboxClassName(className?: string) {
  return cn(
    "relative flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-border bg-background transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out select-none",
    "after:absolute after:-inset-2.5",
    "peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
    "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-foreground",
    "peer-indeterminate:border-accent peer-indeterminate:bg-accent peer-indeterminate:text-accent-foreground",
    "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
    "peer-enabled:active:scale-90",
    className,
  );
}

const iconClassName =
  "absolute size-3.5 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none";

export interface CheckboxProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "type" | "children"
> {
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
}

export function Checkbox({
  label,
  checked: controlledChecked,
  defaultChecked,
  onCheckedChange,
  indeterminate = false,
  id,
  className,
  disabled,
  ref,
  ...props
}: CheckboxProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(defaultChecked));

  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? Boolean(controlledChecked) : uncontrolledChecked;

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node) node.indeterminate = indeterminate;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref, indeterminate],
  );

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex w-fit items-center gap-3",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-flex items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          ref={setRefs}
          checked={isChecked}
          disabled={disabled}
          onChange={(event) => {
            const nextChecked = event.target.checked;

            if (!isControlled) {
              setUncontrolledChecked(nextChecked);
            }

            onCheckedChange?.(nextChecked);
          }}
          className="peer sr-only"
          {...props}
        />

        <span aria-hidden="true" className={checkboxClassName()}>
          <Check
            strokeWidth={3.5}
            className={cn(
              iconClassName,
              isChecked && !indeterminate ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
          <Minus
            strokeWidth={4}
            className={cn(
              iconClassName,
              indeterminate ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
        </span>
      </span>

      {label ? (
        <span
          className={cn(
            "text-sm leading-snug font-medium transition-colors duration-150 select-none",
            isChecked || indeterminate ? "text-foreground" : "text-muted",
            disabled && "opacity-50",
          )}
        >
          {label}
        </span>
      ) : null}
    </label>
  );
}
