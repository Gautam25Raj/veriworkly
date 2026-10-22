import { AlertTriangle, Check, Minus, X } from "lucide-react";

import { type MatrixValue } from "../../types";

interface MatrixValueCellProps {
  value: MatrixValue | undefined;
  emphasize?: boolean;
}

// Word starts, so "limit" does not match inside "unlimited".
const LIMITED = /\b(limit|trial|capped|paid|watermark|required|only)/i;
const POSITIVE = /\b(unlimited|included|no login)/i;

/**
 * One cell of a comparison. The icon and the word carry the state together, so colour is never
 * the only signal: a tick says "Yes", a cross says "No", a warning sits beside a limit.
 */
export const MatrixValueCell = ({ value, emphasize }: MatrixValueCellProps) => {
  if (value === undefined || value === null) {
    return (
      <span className="text-muted inline-flex items-center gap-2 text-[15px]">
        <Minus className="size-4" aria-hidden="true" />
        Not stated
      </span>
    );
  }

  if (typeof value === "boolean") {
    return value ? (
      <span className="text-success inline-flex items-center gap-2 text-[15px] font-semibold">
        <Check className="size-4 stroke-[2.5]" aria-hidden="true" />
        Yes
      </span>
    ) : (
      <span className="text-muted inline-flex items-center gap-2 text-[15px]">
        <X className="text-destructive size-4 stroke-[2.5]" aria-hidden="true" />
        No
      </span>
    );
  }

  const isLimited = LIMITED.test(value);
  const isPositive = !isLimited && POSITIVE.test(value);

  return (
    <span
      className={`inline-flex items-start gap-2 text-[15px] leading-6 ${
        emphasize ? "font-semibold" : isLimited ? "font-medium" : "text-muted"
      }`}
    >
      {isLimited ? (
        <AlertTriangle className="text-warning mt-1 size-4 shrink-0" aria-hidden="true" />
      ) : isPositive || emphasize ? (
        <Check className="text-success mt-1 size-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
      ) : null}
      <span>{value}</span>
    </span>
  );
};

export default MatrixValueCell;
