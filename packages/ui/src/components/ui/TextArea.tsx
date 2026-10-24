import * as React from "react";

import { cn } from "../../utils";

import { fieldBase, fieldOutline } from "./field";

export interface TextAreaProps extends React.ComponentProps<"textarea"> {
  error?: boolean;
}

export function TextArea({
  className,
  error,
  "aria-invalid": ariaInvalid,
  ...props
}: TextAreaProps) {
  return (
    <textarea
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={cn(
        "flex min-h-30 resize-none rounded-2xl px-4 py-3 text-sm max-sm:text-base",
        fieldBase,
        fieldOutline,
        className,
      )}
      {...props}
    />
  );
}
