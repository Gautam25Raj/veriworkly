"use client";

import {
  type ReactNode,
  type KeyboardEvent,
  useId,
  useRef,
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
  useLayoutEffect,
} from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../../utils";

type AccordionType = "single" | "multiple";

type AccordionContextValue = {
  expanded: string[];
  toggleItem: (value: string) => void;
  openItem: (value: string) => void;
};

type AccordionItemContextValue = {
  value: string;
  triggerId: string;
  contentId: string;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

const COLLAPSE_MS = 320;

function useAccordionContext() {
  const ctx = useContext(AccordionContext);

  if (!ctx) {
    throw new Error("Accordion components must be used inside Accordion.");
  }

  return ctx;
}

function useAccordionItemContext() {
  const ctx = useContext(AccordionItemContext);

  if (!ctx) {
    throw new Error("AccordionTrigger and AccordionContent must be used inside AccordionItem.");
  }

  return ctx;
}

const toArray = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

type AccordionProps = {
  children: ReactNode;
  className?: string;
  type?: AccordionType;
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (expanded: string[]) => void;
};

export function Accordion({
  children,
  className,
  type = "single",
  collapsible = true,
  defaultValue,
  value,
  onValueChange,
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = useState<string[]>(() => toArray(defaultValue));

  const isControlled = value !== undefined;
  const expanded = useMemo(
    () => (isControlled ? toArray(value) : uncontrolled),
    [isControlled, value, uncontrolled],
  );

  const commit = useCallback(
    (next: string[]) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const toggleItem = useCallback(
    (item: string) => {
      const isOpen = expanded.includes(item);

      if (type === "single") {
        if (isOpen && !collapsible) return;
        commit(isOpen ? [] : [item]);
        return;
      }

      commit(isOpen ? expanded.filter((entry) => entry !== item) : [...expanded, item]);
    },
    [expanded, type, collapsible, commit],
  );

  const openItem = useCallback(
    (item: string) => {
      if (expanded.includes(item)) return;
      commit(type === "single" ? [item] : [...expanded, item]);
    },
    [expanded, type, commit],
  );

  const contextValue = useMemo(
    () => ({ expanded, toggleItem, openItem }),
    [expanded, toggleItem, openItem],
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div data-accordion-root="true" className={cn("flex flex-col gap-3", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

type AccordionItemProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  const generatedId = useId();

  const itemContext = useMemo(
    () => ({
      value,
      triggerId: `accordion-trigger-${generatedId}`,
      contentId: `accordion-content-${generatedId}`,
    }),
    [value, generatedId],
  );

  return (
    <AccordionItemContext.Provider value={itemContext}>
      <div
        data-accordion-item=""
        className={cn(
          "border-border/70 bg-card/90 overflow-hidden rounded-2xl border shadow-[0_12px_35px_-28px_rgba(15,23,42,0.65)] transition-colors",
          className,
        )}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

type AccordionTriggerProps = {
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3" | "h4";
};

export function AccordionTrigger({
  children,
  className,
  headingLevel: Heading = "h3",
}: AccordionTriggerProps) {
  const { value, triggerId, contentId } = useAccordionItemContext();
  const { expanded, toggleItem } = useAccordionContext();

  const isOpen = expanded.includes(value);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const root = event.currentTarget.closest('[data-accordion-root="true"]');

    if (!root) {
      return;
    }

    const triggerNodes = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger="true"]'),
    ).filter((node) => node.closest('[data-accordion-root="true"]') === root);
    const currentIndex = triggerNodes.indexOf(event.currentTarget);

    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % triggerNodes.length;
    else if (event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + triggerNodes.length) % triggerNodes.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = triggerNodes.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      triggerNodes[nextIndex]?.focus();
    }
  };

  return (
    <Heading>
      <button
        type="button"
        id={triggerId}
        onKeyDown={onKeyDown}
        aria-expanded={isOpen}
        aria-controls={contentId}
        data-accordion-trigger="true"
        onClick={() => toggleItem(value)}
        className={cn(
          "text-foreground hover:bg-background/70 focus-visible:ring-accent flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left text-base font-semibold tracking-tight text-balance transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
          className,
        )}
      >
        <span className="pr-4">{children}</span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-muted size-5 shrink-0 transition-[transform,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isOpen && "text-foreground rotate-180",
          )}
        />
      </button>
    </Heading>
  );
}

type AccordionContentProps = {
  children: ReactNode;
  className?: string;
};

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { value, triggerId, contentId } = useAccordionItemContext();
  const { expanded, openItem } = useAccordionContext();

  const regionRef = useRef<HTMLDivElement>(null);
  const isOpen = expanded.includes(value);

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    if (isOpen) {
      region.removeAttribute("hidden");
      region.style.visibility = "";
      return;
    }

    if (!region.hasAttribute("hidden")) {
      const timeout = window.setTimeout(
        () => {
          // React serialises `hidden` as a boolean, so until-found is set by hand.
          region.setAttribute("hidden", "until-found");
          if (!("onbeforematch" in (region as object))) region.style.visibility = "hidden";
        },
        region.dataset.mounted ? COLLAPSE_MS : 0,
      );
      region.dataset.mounted = "true";
      return () => window.clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    region.dataset.mounted = "true";

    const reveal = () => openItem(value);
    region.addEventListener("beforematch", reveal);

    return () => region.removeEventListener("beforematch", reveal);
  }, [openItem, value]);

  return (
    <div
      ref={regionRef}
      role="region"
      id={contentId}
      aria-labelledby={triggerId}
      aria-hidden={!isOpen || undefined}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0 not-data-mounted:invisible",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "border-border/60 text-muted border-t px-5 py-4 text-sm leading-7 text-pretty",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
