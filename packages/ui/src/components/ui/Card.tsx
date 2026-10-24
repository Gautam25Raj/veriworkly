import * as React from "react";

import { cn } from "../../utils";

export type CardProps<T extends React.ElementType = "div"> = {
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithRef<T>, "as" | "className">;

export function Card<T extends React.ElementType = "div">({
  as,
  className,
  ...props
}: CardProps<T>) {
  const Component: React.ElementType = as ?? "div";

  return (
    <Component
      className={cn(
        "bg-card text-foreground border-border/50 overflow-hidden rounded-3xl border p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
