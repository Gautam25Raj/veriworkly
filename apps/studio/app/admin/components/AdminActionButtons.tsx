"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@veriworkly/ui";

import { fetchApiData } from "@/utils/fetchApiData";
import { triggerAdminGithubSync } from "@/features/admin/services/admin-actions";

const AdminActionButtons = () => {
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);

      await fetchApiData("/auth/sign-out", { method: "POST" });

      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to sign out");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <Button
        size="sm"
        variant="secondary"
        loading={isSyncing}
        onClick={() => void handleSyncNow()}
      >
        Sync GitHub now
      </Button>

      <Button
        size="sm"
        variant="secondary"
        loading={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        Sign out
      </Button>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

export default AdminActionButtons;
