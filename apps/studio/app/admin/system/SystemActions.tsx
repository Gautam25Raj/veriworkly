"use client";

import { useState } from "react";

import { Select } from "@veriworkly/ui";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import { flushAdminCache, triggerAdminGithubSync } from "@/features/admin/services/admin-actions";

type CachePrefix =
  "portfolio:public" | "user:profile" | "affiliate" | "credits" | "changelog" | "roadmap";

const CACHE_PREFIXES: Array<{ value: CachePrefix; label: string; description: string }> = [
  {
    value: "portfolio:public",
    label: "Public portfolios",
    description: "Cached public portfolio pages and the public portfolio list.",
  },
  {
    value: "user:profile",
    label: "User profiles",
    description: "Per-user profile snapshots, including entitlement state.",
  },
  {
    value: "affiliate",
    label: "Affiliate dashboards",
    description: "Affiliate dashboard and leaderboard aggregates.",
  },
  { value: "credits", label: "Credit wallets", description: "Cached credit wallet balances." },
  { value: "changelog", label: "Changelog", description: "Public changelog reads." },
  { value: "roadmap", label: "Roadmap", description: "Public roadmap reads." },
];

/**
 * Session records are deliberately not flushable from here — the server only accepts these
 * six prefixes, so no combination of clicks on this page can sign every user out.
 */
export function CacheFlushControls() {
  const [prefix, setPrefix] = useState<CachePrefix>("portfolio:public");

  const selected = CACHE_PREFIXES.find((entry) => entry.value === prefix);

  return (
    <div className="space-y-3">
      <Select
        aria-label="Cache prefix"
        className="h-9 text-xs"
        value={prefix}
        onChange={(event) => setPrefix(event.target.value as CachePrefix)}
      >
        {CACHE_PREFIXES.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>

      <p className="text-muted text-xs leading-5">{selected?.description}</p>

      <AdminActionDialog
        trigger="Flush cache"
        title="Flush this cache prefix"
        description={`Every key under "${prefix}" is deleted. The next request for each rebuilds from the database — expect a brief latency spike, not data loss.`}
        confirmLabel="Flush"
        onConfirm={async (reason) => {
          await flushAdminCache(prefix, reason);
        }}
      />
    </div>
  );
}

export function GithubSyncControls({ nextSyncAt }: { nextSyncAt: string | null }) {
  const [force, setForce] = useState(false);

  return (
    <div className="space-y-3">
      <label className="text-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={force}
          onChange={(event) => setForce(event.target.checked)}
        />
        Force a full sync (ignore the ETag and re-fetch everything)
      </label>

      {nextSyncAt ? (
        <p className="text-muted text-xs">
          The scheduled job next runs at {new Date(nextSyncAt).toLocaleString()}.
        </p>
      ) : null}

      <AdminActionDialog
        trigger="Sync now"
        triggerVariant="primary"
        title="Trigger a GitHub sync"
        description={
          force
            ? "A full re-fetch of every issue and pull request. Slower, and it spends more of the GitHub API quota."
            : "An incremental sync — only changes since the last run are fetched."
        }
        confirmLabel="Run sync"
        onConfirm={async (reason) => {
          await triggerAdminGithubSync(reason, force);
        }}
      />
    </div>
  );
}
