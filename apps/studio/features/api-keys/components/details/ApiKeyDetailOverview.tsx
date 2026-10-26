import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Ban, Calendar, Clock3 } from "lucide-react";

import type { ApiKeyDetailRecord } from "../ApiKeyTypes";
import type { ApiKeyStatus } from "../../api-key-service";

import { Card } from "@veriworkly/ui";

import { LocalDateTime } from "../LocalDateTime";

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <Card className="rounded-xl p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <p className="mt-2 text-sm font-semibold">{value}</p>
    </Card>
  );
}

function dateOr(value: string | null, fallback: string) {
  return value ? <LocalDateTime iso={value} /> : fallback;
}

export function ApiKeyDetailOverview({
  data,
  status,
}: {
  data: ApiKeyDetailRecord;
  status: ApiKeyStatus;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DetailMetric icon={Calendar} label="Created" value={dateOr(data.createdAt, "Never")} />
      <DetailMetric icon={Activity} label="Last used" value={dateOr(data.lastUsed, "Never")} />
      <DetailMetric
        icon={Clock3}
        label={status === "expired" ? "Expired" : "Expires"}
        value={dateOr(data.expiresAt, "No expiry")}
      />
      {status === "disabled" ? (
        <DetailMetric icon={Ban} label="Disabled" value="By an administrator" />
      ) : (
        <DetailMetric icon={Ban} label="Revoked" value={dateOr(data.revokedAt, "Not revoked")} />
      )}
    </div>
  );
}
