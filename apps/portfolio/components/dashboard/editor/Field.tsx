import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  children: ReactNode;
  /** Optional hint shown under the control (e.g. "Comma separated."). */
  help?: string;
}

export function Field({ label, children, help }: FieldProps) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[var(--color-ink-soft)]">
      {label}
      {children}
      {help ? <span className="text-muted text-[11px] font-medium">{help}</span> : null}
    </label>
  );
}
