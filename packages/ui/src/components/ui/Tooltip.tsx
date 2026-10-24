"use client";

import * as React from "react";

import { cn } from "../../utils";
import { supportsPopover } from "../../lib/popover";

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  onlyShowIfTruncated?: boolean;
}

type Side = NonNullable<TooltipProps["side"]>;

const GAP = 8;
const VIEWPORT_PADDING = 8;
const HIDE_GRACE_MS = 100;
const WARM_WINDOW_MS = 400;

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

const ORIGIN: Record<Side, string> = {
  top: "origin-bottom",
  bottom: "origin-top",
  left: "origin-right",
  right: "origin-left",
};

let openTooltips = 0;
let lastClosedAt = 0;

const isWarm = () => openTooltips > 0 || Date.now() - lastClosedAt < WARM_WINDOW_MS;

const FOCUSABLE_SELECTOR =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

function place(trigger: DOMRect, tip: { width: number; height: number }, preferred: Side) {
  const fits = (side: Side) => {
    if (side === "top") return trigger.top - GAP - tip.height >= VIEWPORT_PADDING;
    if (side === "bottom")
      return trigger.bottom + GAP + tip.height <= window.innerHeight - VIEWPORT_PADDING;
    if (side === "left") return trigger.left - GAP - tip.width >= VIEWPORT_PADDING;
    return trigger.right + GAP + tip.width <= window.innerWidth - VIEWPORT_PADDING;
  };

  const side = fits(preferred) || !fits(OPPOSITE[preferred]) ? preferred : OPPOSITE[preferred];

  let top: number;
  let left: number;

  if (side === "top" || side === "bottom") {
    top = side === "top" ? trigger.top - GAP - tip.height : trigger.bottom + GAP;
    left = trigger.left + trigger.width / 2 - tip.width / 2;
  } else {
    left = side === "left" ? trigger.left - GAP - tip.width : trigger.right + GAP;
    top = trigger.top + trigger.height / 2 - tip.height / 2;
  }

  const clamp = (value: number, size: number, viewport: number) =>
    Math.min(Math.max(value, VIEWPORT_PADDING), viewport - size - VIEWPORT_PADDING);

  return {
    side,
    top: clamp(top, tip.height, window.innerHeight),
    left: clamp(left, tip.width, window.innerWidth),
  };
}

export function Tooltip({
  children,
  content,
  className,
  side = "top",
  delay = 200,
  onlyShowIfTruncated = false,
}: TooltipProps) {
  const tooltipId = React.useId();
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const [placedSide, setPlacedSide] = React.useState<Side>(side);

  const clearTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const show = React.useCallback(() => {
    clearTimer();
    if (open) return;

    if (onlyShowIfTruncated) {
      const child = triggerRef.current?.firstElementChild as HTMLElement | null;
      const truncated =
        child && (child.scrollHeight > child.clientHeight || child.scrollWidth > child.clientWidth);
      if (!truncated) return;
    }

    const warm = isWarm();
    setInstant(warm);

    if (warm) setOpen(true);
    else timeoutRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay, onlyShowIfTruncated, open]);

  const hide = React.useCallback((immediately = false) => {
    clearTimer();

    const close = () => setOpen(false);

    if (immediately) close();
    else timeoutRef.current = setTimeout(close, HIDE_GRACE_MS);
  }, []);

  React.useEffect(() => clearTimer, []);

  React.useEffect(() => {
    const target =
      triggerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? triggerRef.current;
    if (!target) return;

    const existing = target.getAttribute("aria-describedby");
    const ids = new Set(existing?.split(/\s+/).filter(Boolean));
    ids.add(tooltipId);
    target.setAttribute("aria-describedby", [...ids].join(" "));

    return () => {
      ids.delete(tooltipId);
      if (ids.size) target.setAttribute("aria-describedby", [...ids].join(" "));
      else target.removeAttribute("aria-describedby");
    };
  }, [tooltipId]);

  React.useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    if (!tooltip || !trigger) return;

    const popover = supportsPopover(tooltip);

    if (!open) {
      if (popover && tooltip.matches(":popover-open")) tooltip.hidePopover();
      return;
    }

    if (popover && !tooltip.matches(":popover-open")) tooltip.showPopover();

    // Measured where it last sat, a tip near the right edge shrinks to fit.
    tooltip.style.top = "0px";
    tooltip.style.left = "0px";

    const anchor = (trigger.firstElementChild as HTMLElement | null) ?? trigger;
    const placement = place(
      anchor.getBoundingClientRect(),
      // offsetWidth ignores the entry scale; getBoundingClientRect does not.
      { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
      side,
    );

    tooltip.style.top = `${placement.top}px`;
    tooltip.style.left = `${placement.left}px`;
    setPlacedSide(placement.side);

    const dismiss = () => hide(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss();
    };

    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    // Capture phase so this runs before the Modal's Escape handler.
    window.addEventListener("keydown", onKeyDown, true);
    openTooltips++;

    return () => {
      openTooltips--;
      lastClosedAt = Date.now();
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, side, hide]);

  return (
    <div
      ref={triggerRef}
      className="contents"
      onMouseEnter={show}
      onMouseLeave={() => hide()}
      onFocus={(event) => {
        if ((event.target as HTMLElement).matches(":focus-visible")) show();
      }}
      onBlur={() => hide(true)}
      onPointerDown={() => hide(true)}
    >
      {children}

      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        popover="manual"
        data-open={open ? "" : undefined}
        data-instant={instant ? "" : undefined}
        className={cn(
          "fixed inset-auto m-0 overflow-visible border-0 bg-transparent p-0",
          "not-supports-[selector(:popover-open)]:not-data-open:hidden",
          "transition-[opacity,transform] duration-150 ease-out starting:scale-[0.97] starting:opacity-0",
          "data-instant:transition-none motion-reduce:transition-none",
          ORIGIN[placedSide],
          className,
        )}
      >
        <div className="bg-foreground text-background max-w-70 rounded-2xl px-4 py-2.5 text-center text-xs leading-relaxed font-medium wrap-break-word whitespace-normal shadow-lg">
          {content}
        </div>
      </div>
    </div>
  );
}
