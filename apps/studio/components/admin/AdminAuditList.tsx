import Panel from "@/components/admin/Panel";

import type { AdminAuditEntry } from "@/features/admin/types/admin-types";
import { formatDateTime, humanizeKey } from "@/features/admin/utils/admin-format";

/** The admin actions taken against one record, as shown on its detail page. */
export default function AdminAuditList({
  title,
  emptyMessage,
  entries,
}: {
  title: string;
  emptyMessage: string;
  entries: AdminAuditEntry[];
}) {
  return (
    <Panel className="space-y-3 rounded-xl p-4">
      <h3 className="text-foreground font-semibold tracking-tight">{title}</h3>

      {entries.length === 0 ? (
        <p className="text-muted text-sm">{emptyMessage}</p>
      ) : (
        <div className="divide-border/50 divide-y">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-0.5 py-2.5 text-sm">
              <p className="text-foreground font-medium">{humanizeKey(entry.action)}</p>
              <p className="text-muted text-xs">
                {entry.actor?.email ?? "system"} · {formatDateTime(entry.createdAt)}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
