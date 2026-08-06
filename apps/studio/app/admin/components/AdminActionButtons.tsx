"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

import { Button } from "@veriworkly/ui";

import { triggerAdminGithubSync } from "@/features/admin/services/admin-actions";

/**
 * Dashboard-level actions.
 *
 * Sign-out used to live here too. It now sits in the shell's topbar, where it is reachable from
 * every admin page rather than only from `/admin`.
 */
const AdminActionButtons = () => {
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      setError("");

      // The sync endpoint audits who triggered it, so it always needs a reason.
      await triggerAdminGithubSync("Manual sync from the admin dashboard");

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to sync GitHub");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        className="h-8 rounded-lg"
        loading={isSyncing}
        onClick={() => void handleSyncNow()}
      >
        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Sync GitHub
      </Button>

      {error ? (
        <p role="alert" className="text-destructive max-w-56 text-right text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default AdminActionButtons;
