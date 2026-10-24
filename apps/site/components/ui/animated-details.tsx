"use client";

import { useState, type ReactNode } from "react";
import { m, type HTMLMotionProps, type Transition } from "framer-motion";

import { useMounted } from "@/hooks/use-mounted";

interface AnimatedDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  /** How the answer opens and closes. */
  panelTransition?: Transition;
  /** Entrance, scroll-in and hover props for the card itself (framer `m.details` props). */
  motionProps?: HTMLMotionProps<"details">;
}

/**
 * A native `<details>` that animates like the old framer accordions.
 *
 * Before hydration it is a plain disclosure: every answer is in the server HTML (the FAQPage
 * structured data has to match the page) and works without JavaScript. Once interactive, the
 * open state is controlled, the panel springs between height 0 and auto, and the element keeps
 * its `open` attribute until the closing animation ends so the answer is not cut off.
 * Requires a <MotionIsland> above it.
 */
export function AnimatedDetails({
  open,
  onOpenChange,
  summary,
  children,
  className,
  summaryClassName,
  panelTransition = { type: "spring", stiffness: 300, damping: 28 },
  motionProps,
}: AnimatedDetailsProps) {
  const hydrated = useMounted();

  // Keep the element open while its answer animates shut, whoever closed it (a click here or
  // another card opening in the same group).
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setClosing(!open);
  }

  if (!hydrated) {
    return (
      <details className={className}>
        <summary className={summaryClassName}>{summary}</summary>
        {children}
      </details>
    );
  }

  return (
    <m.details
      {...motionProps}
      open={open || closing}
      className={className}
      // Find-in-page and other browser-initiated opens.
      onToggle={(event) => {
        if (event.currentTarget.open && !open && !closing) onOpenChange(true);
      }}
    >
      <summary
        className={summaryClassName}
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
      >
        {summary}
      </summary>

      <m.div
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={panelTransition}
        onAnimationComplete={() => {
          if (!open) setClosing(false);
        }}
        className="overflow-hidden"
      >
        {children}
      </m.div>
    </m.details>
  );
}
