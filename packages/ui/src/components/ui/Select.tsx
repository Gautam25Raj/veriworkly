import type * as React from "react";

import { cn } from "../../utils";

import { fieldBase, fieldOutline } from "./field";

export interface SelectProps extends React.ComponentProps<"select"> {
  error?: boolean;
}

export function Select({ className, error, "aria-invalid": ariaInvalid, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={cn(
        "h-11 cursor-pointer rounded-2xl px-4 text-sm shadow-sm max-sm:text-base",
        fieldBase,
        fieldOutline,
        className,
      )}
      {...props}
    />
  );
}
