"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../utils";
import { lockScroll } from "../../lib/scroll-lock";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

type ModalContentProps = React.ComponentProps<"div"> & {
  titleId?: string;
  descriptionId?: string;
};

type LabelSlot = { autoId: string; setId: (id: string | null) => void };
type LabelRegistry = { title: LabelSlot; description: LabelSlot };

const RootContext = React.createContext<{ onClose: () => void } | null>(null);
const LabelContext = React.createContext<LabelRegistry | null>(null);

const modalStack: object[] = [];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 0.11;

const noopSubscribe = () => () => {};

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.tabIndex >= 0 && !element.closest("[inert]") && element.getClientRects().length > 0,
  );
}

function ModalRoot({ open, onClose, children }: ModalProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const pressStartedOnOverlay = React.useRef(false);

  const onCloseRef = React.useRef(onClose);
  React.useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const isClient = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // Deps are [open] only: an inline onClose would otherwise re-run this and steal focus.
  React.useEffect(() => {
    if (!open) return;

    const token = {};
    const restoreFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockScroll = lockScroll();

    modalStack.push(token);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (modalStack[modalStack.length - 1] !== token) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      const dialog = overlayRef.current?.querySelector<HTMLElement>('[role="dialog"]');
      if (event.key !== "Tab" || !dialog) return;

      const focusable = getFocusable(dialog);
      const active = document.activeElement;

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      modalStack.splice(modalStack.indexOf(token), 1);
      unlockScroll();
      restoreFocusTo?.focus({ preventScroll: true });
    };
  }, [open]);

  const rootContext = React.useMemo(() => ({ onClose: () => onCloseRef.current() }), []);

  if (!open || !isClient) return null;

  return createPortal(
    <RootContext.Provider value={rootContext}>
      <div
        ref={overlayRef}
        className={cn(
          "fixed inset-0 z-200 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6",
          "transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0",
        )}
        onPointerDown={(event) => {
          pressStartedOnOverlay.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (pressStartedOnOverlay.current && event.target === event.currentTarget) {
            onCloseRef.current();
          }
          pressStartedOnOverlay.current = false;
        }}
      >
        {children}
      </div>
    </RootContext.Provider>,
    document.body,
  );
}

function ModalContent({
  children,
  className,
  titleId,
  descriptionId,
  onClick,
  ...props
}: ModalContentProps) {
  const root = React.useContext(RootContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ pointerId: number; startY: number; startTime: number } | null>(
    null,
  );

  const autoTitleId = React.useId();
  const autoDescriptionId = React.useId();
  const [registeredTitleId, setTitleId] = React.useState<string | null>(null);
  const [registeredDescriptionId, setDescriptionId] = React.useState<string | null>(null);

  const labels = React.useMemo<LabelRegistry>(
    () => ({
      title: { autoId: autoTitleId, setId: setTitleId },
      description: { autoId: autoDescriptionId, setId: setDescriptionId },
    }),
    [autoTitleId, autoDescriptionId],
  );

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const frame = window.requestAnimationFrame(() => {
      if (!content.contains(document.activeElement)) {
        content.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const content = contentRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !content) return;

    dragRef.current = null;

    const distance = event.clientY - drag.startY;
    const velocity = distance / Math.max(1, event.timeStamp - drag.startTime);

    content.style.transition = "";
    content.style.transform = "";

    if (distance >= SWIPE_DISTANCE || (distance > 10 && velocity > SWIPE_VELOCITY)) {
      root?.onClose();
    }
  };

  return (
    <LabelContext.Provider value={labels}>
      <div
        role="dialog"
        tabIndex={-1}
        ref={contentRef}
        aria-modal="true"
        aria-labelledby={titleId ?? registeredTitleId ?? undefined}
        aria-describedby={descriptionId ?? registeredDescriptionId ?? undefined}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        className={cn(
          "border-border bg-card relative w-full min-w-0 rounded-t-3xl border p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl outline-hidden",
          "md:max-w-lg md:rounded-3xl",
          "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] starting:translate-y-full",
          "md:duration-200 md:ease-[cubic-bezier(0.16,1,0.3,1)] md:starting:translate-y-0 md:starting:scale-95 md:starting:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="-mt-2 mb-0.5 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
          onPointerDown={(event) => {
            if (event.button !== 0 || dragRef.current || !contentRef.current) return;

            dragRef.current = {
              pointerId: event.pointerId,
              startY: event.clientY,
              startTime: event.timeStamp,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            contentRef.current.style.transition = "none";
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId || !contentRef.current) return;

            const distance = event.clientY - drag.startY;
            const offset = distance >= 0 ? distance : -Math.sqrt(-distance) * 2;
            contentRef.current.style.transform = `translateY(${offset}px)`;
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="bg-muted/60 h-1.5 w-12 rounded-full" />
        </div>

        {children}
      </div>
    </LabelContext.Provider>
  );
}

function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-2 space-y-1", className)} {...props} />;
}

function useLabelId(slot: keyof LabelRegistry, id: string | undefined) {
  const label = React.useContext(LabelContext)?.[slot];
  const resolved = id ?? label?.autoId;
  const setId = label?.setId;

  React.useLayoutEffect(() => {
    if (!setId || !resolved) return;
    setId(resolved);
    return () => setId(null);
  }, [setId, resolved]);

  return resolved;
}

function ModalTitle({ className, id, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      id={useLabelId("title", id)}
      className={cn("text-foreground text-lg font-bold text-balance", className)}
      {...props}
    />
  );
}

function ModalDescription({ className, id, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      id={useLabelId("description", id)}
      className={cn("text-muted text-sm text-pretty", className)}
      {...props}
    />
  );
}

function ModalBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("max-h-[60dvh] overflow-y-auto py-2", className)} {...props} />;
}

function ModalFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "md:bg-foreground/3 flex flex-col-reverse gap-3 border-t px-4 py-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export const Modal = Object.assign(ModalRoot, {
  Content: ModalContent,
  Header: ModalHeader,
  Title: ModalTitle,
  Description: ModalDescription,
  Body: ModalBody,
  Footer: ModalFooter,
});
