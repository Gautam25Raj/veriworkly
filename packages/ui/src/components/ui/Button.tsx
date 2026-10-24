import * as React from "react";

import { cn } from "../../utils";
import { Loader2 } from "lucide-react";

type ChildWithProps = {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  [key: string]: unknown;
};

const buttonVariants = {
  primary: "bg-accent text-accent-foreground shadow-sm hover:opacity-90",
  secondary: "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-background",
  ghost: "bg-transparent text-foreground hover:bg-card",
} as const;

const buttonSizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center rounded-full font-medium transition duration-150 ease-out active:scale-[0.97]",
    "focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
    "disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;

  asChild?: boolean;

  loading?: boolean;

  loadingText?: string;
}

export const Button = ({
  className,
  size = "md",
  variant = "primary",
  type = "button",
  asChild = false,
  loading = false,
  loadingText = "Loading…",
  disabled,
  children,
  ...props
}: ButtonProps) => {
  const isDisabled = Boolean(disabled || loading);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<ChildWithProps>;
    const { onClick, ...rest } = props;
    const childOnClick = child.props.onClick;

    return React.cloneElement(child, {
      ...(rest as Record<string, unknown>),
      className: buttonClassName(variant, size, cn(className, child.props.className)),
      ...(isDisabled && { "aria-disabled": true, "data-disabled": "", tabIndex: -1 }),
      ...(loading && { "aria-busy": true }),
      // No handler of our own: Button renders in Server Components around next/link.
      onClick:
        onClick && childOnClick
          ? (event: React.MouseEvent<HTMLElement>) => {
              childOnClick(event);
              if (!event.defaultPrevented) onClick(event as React.MouseEvent<HTMLButtonElement>);
            }
          : (onClick ?? childOnClick),
    });
  }

  return (
    <button
      className={buttonClassName(variant, size, className)}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-disabled={isDisabled ? "" : undefined}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
