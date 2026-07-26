import { Check, Minus, X } from "lucide-react";

import { type MatrixValue } from "@/config/compare";

const MatrixValueCell = ({ value, emphasize }: { value: MatrixValue; emphasize?: boolean }) => {
  if (typeof value === "boolean") {
    return value ? (
      <span
        className={`inline-flex size-6 items-center justify-center rounded-full ${
          emphasize
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    ) : (
      <span className="bg-muted/10 text-muted/60 inline-flex size-6 items-center justify-center rounded-full">
        <X className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={`text-xs leading-snug ${emphasize ? "text-foreground font-medium" : "text-muted"}`}
    >
      {value || <Minus className="size-3.5" aria-hidden="true" />}
    </span>
  );
};

export default MatrixValueCell;
