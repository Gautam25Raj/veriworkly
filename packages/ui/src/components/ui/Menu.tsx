"use client";

import * as React from "react";

import { cn } from "../../utils";

import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";

type MenuRenderProps = {
  close: () => void;
  menuId: string;
  open: boolean;
  toggle: () => void;
};

interface MenuProps {
  align?: "left" | "right";
  children: (props: MenuRenderProps) => React.ReactNode;
  panelClassName?: string;
  size?: "sm" | "md";
  trigger: (props: MenuRenderProps) => React.ReactNode;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';
const TRIGGER_SELECTOR = "button, [href], [tabindex]:not([tabindex='-1'])";

export function Menu({
  align = "right",
  children,
  panelClassName,
  size = "md",
  trigger,
}: MenuProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const typeaheadRef = React.useRef({ query: "", timeout: 0 });
  const menuId = React.useId();
  const [open, setOpen] = React.useState(false);

  const getItems = React.useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
    [],
  );

  const focusTrigger = React.useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>(TRIGGER_SELECTOR)?.focus();
  }, []);

  const close = React.useCallback(() => {
    const panel = document.getElementById(menuId);
    if (panel?.contains(document.activeElement)) {
      panel.parentElement?.querySelector<HTMLElement>(TRIGGER_SELECTOR)?.focus();
    }
    setOpen(false);
  }, [menuId]);

  const toggle = React.useCallback(() => setOpen((value) => !value), []);

  React.useEffect(() => {
    if (!open) return;

    getItems()[0]?.focus({ preventScroll: true });

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, getItems]);

  React.useEffect(() => () => window.clearTimeout(typeaheadRef.current.timeout), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      focusTrigger();
      return;
    }

    if (event.key === "Tab") {
      if (panelRef.current?.contains(event.target as Node)) focusTrigger();
      setOpen(false);
      return;
    }

    if (!panelRef.current?.contains(event.target as Node)) return;

    const items = getItems();
    if (!items.length) return;

    const activeIndex = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;

    if (event.key === "ArrowDown") next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
    else if (event.key === "ArrowUp")
      next = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey) {
      const typeahead = typeaheadRef.current;
      window.clearTimeout(typeahead.timeout);
      typeahead.query += event.key.toLowerCase();
      typeahead.timeout = window.setTimeout(() => (typeahead.query = ""), 500);

      const ordered = [...items.slice(activeIndex + 1), ...items.slice(0, activeIndex + 1)];
      const match = ordered.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith(typeahead.query),
      );
      if (match) next = items.indexOf(match);
    }

    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <div className="relative" ref={rootRef} onKeyDown={handleKeyDown}>
      {trigger({ close, menuId, open, toggle })}

      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          className={cn(
            "border-border bg-card absolute z-30 mt-2 border shadow-xl ring-1 ring-black/5",
            "transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] starting:scale-95 starting:opacity-0",
            size === "sm" ? "min-w-40 rounded-xl p-1" : "min-w-44 rounded-2xl p-1.5",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            panelClassName,
          )}
        >
          {children({ close, menuId, open, toggle })}
        </div>
      ) : null}
    </div>
  );
}

interface MenuItemProps extends Omit<ButtonProps, "size" | "variant" | "asChild"> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function MenuItem({
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: MenuItemProps) {
  return (
    <Button
      className={cn(
        "hover:bg-accent/10 focus-visible:bg-accent/10 h-9 w-full justify-start gap-2 rounded-xl px-3 text-sm focus-visible:ring-offset-0 focus-visible:ring-inset active:scale-100",
        className,
      )}
      role="menuitem"
      tabIndex={-1}
      size={size}
      variant={variant}
      {...props}
    >
      {children}
    </Button>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("bg-border my-1 h-px", className)} />;
}
