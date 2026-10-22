import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";
import type { AtsVerdict } from "../../types";

const CONFIG: Record<AtsVerdict, { label: string; className: string; icon: typeof CheckCircle2 }> =
  {
    strong: {
      label: "Strong: ready to send",
      className: "bg-success/10 text-success",
      icon: CheckCircle2,
    },
    "needs-work": {
      label: "Needs work before you apply",
      className: "bg-warning/10 text-warning",
      icon: TriangleAlert,
    },
    weak: {
      label: "Weak: likely to be filtered out",
      className: "bg-destructive/10 text-destructive",
      icon: XCircle,
    },
  };

export function VerdictBadge({ verdict }: { verdict: AtsVerdict }) {
  const { label, className, icon: Icon } = CONFIG[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
    </span>
  );
}

export default VerdictBadge;
