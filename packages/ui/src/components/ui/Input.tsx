import * as React from "react";

import { cn } from "../../utils";

import { fieldBase, fieldOutline } from "./field";

const inputVariants = {
  outline: fieldOutline,
  filled: "border-transparent bg-foreground/5 hover:bg-foreground/8 focus-visible:bg-background",
  ghost: "border-transparent bg-transparent hover:bg-accent/5 focus-visible:bg-background",
} as const;

const inputSizes = {
  sm: "h-9 px-3 text-xs max-sm:text-base rounded-lg",
  md: "h-11 px-4 text-sm max-sm:text-base rounded-xl",
  lg: "h-12 px-5 text-base rounded-2xl",
} as const;

export type InputVariant = keyof typeof inputVariants;
export type InputSize = keyof typeof inputSizes;

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  variant?: InputVariant;
  inputSize?: InputSize;
  error?: boolean;
}

export function Input({
  className,
  variant = "outline",
  inputSize = "md",
  error,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  return (
    <input
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={cn(
        "flex",
        fieldBase,
        "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
        inputSizes[inputSize],
        inputVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
