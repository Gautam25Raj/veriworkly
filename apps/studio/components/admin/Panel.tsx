import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@veriworkly/ui";

/**
 * The base surface for every admin panel.
 *
 * This deliberately does not wrap the shared `Card` from @veriworkly/ui. That component bakes
 * in `rounded-3xl`, `p-5` and a hardcoded `border-zinc-200/50` — a 24px radius and a literal
 * zinc border are right for a marketing card and wrong for a dense data panel, and overriding
 * all three on every usage is how the current admin ended up looking inconsistent. Owning the
 * primitive here means the admin's radius and border come from one place and track the design
 * tokens rather than a fixed palette value.
 */

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** `flush` removes padding for panels whose child manages its own edges (tables, charts). */
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
} as const;

export function Panel({ className, as: Component = "div", padding = "md", ...props }: PanelProps) {
  return (
    <Component
      className={cn(
        // `h-full` + column flex so a panel fills its grid row and can hand the leftover height
        // to a `PanelBody`. Grid rows stretch their items to the tallest one either way — the
        // difference is whether a short panel ends in a dead void or in balanced space.
        "border-border bg-card flex h-full flex-col rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        paddingStyles[padding],
        className,
      )}
      {...props}
    />
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  /** Secondary line under the title. Keep it to one sentence — this is chrome, not content. */
  description?: ReactNode;
  /** Right-aligned controls: a "view all" link, a filter, a refresh button. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The header strip inside a `padding="none"` panel. Uses a bottom border rather than a gap so a
 * table's first row sits flush against it and the panel reads as one object.
 */
export function PanelHeader({ title, description, actions, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        // The fixed min-height is load-bearing, not cosmetic. Panels sit side by side in a grid
        // row, and a header with a description is ~16px taller than one without — so a row
        // mixing the two drew its horizontal rules at two different heights, which is the kind
        // of one-off misalignment that reads as "sloppy" without being locatable. Pinning the
        // height means every rule across a row lines up whatever each panel chose to say.
        "border-border flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-foreground truncate text-sm font-semibold tracking-tight">{title}</h3>

        {description ? <p className="text-muted mt-0.5 truncate text-xs">{description}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The content region of a `padding="none"` panel, below its header.
 *
 * A grid row stretches every panel to the height of the tallest one. Without this, a short
 * panel (a three-segment bar) next to a tall one (a health-check list) pinned its content to
 * the top and left 150px of blank card underneath — the single most obvious flaw on the
 * dashboard, and one that recurred in every mixed-height row.
 *
 * `fill` takes the leftover height, and `align` decides what to do with it: `center` for a
 * chart or bar that should sit optically centred in whatever room it gets, `between` for a
 * body whose last child is a summary footer that belongs at the bottom edge, `start` (the
 * default) for lists that must stay top-aligned to be scannable.
 */
export function PanelBody({
  align = "start",
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "between";
  padding?: "none" | "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        align === "center" && "justify-center",
        align === "between" && "justify-between",
        paddingStyles[padding],
        className,
      )}
      {...props}
    />
  );
}

/**
 * A labelled row of the form `label ......... value`, the shape most of the admin's read-only
 * detail panels take. Centralised so the label/value contrast is identical everywhere.
 */
export function PanelRow({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", className)}>
      <span className="text-muted min-w-0 truncate">{label}</span>
      <span className="text-foreground admin-numeric shrink-0 font-medium">{value}</span>
    </div>
  );
}

export default Panel;
