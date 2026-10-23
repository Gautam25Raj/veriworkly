import type * as React from "react";

import { cn } from "../../utils";

const badgeVariants = {
  neutral: "border-border bg-background text-muted",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
} as const;

export type BadgeVariant = keyof typeof badgeVariants;

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-3 py-1 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
