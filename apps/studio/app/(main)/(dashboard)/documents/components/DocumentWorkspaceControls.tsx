"use client";

import type { ReactNode } from "react";

export function IconToggle({
  active,
  label,
  children,
  onClick,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={
        active
          ? "bg-card flex h-8 w-8 items-center justify-center rounded-lg shadow-sm"
          : "text-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg"
      }
    >
      {children}
    </button>
  );
}
