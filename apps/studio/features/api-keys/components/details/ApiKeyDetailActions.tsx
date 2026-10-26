import { Ban, RotateCw, Trash2 } from "lucide-react";

import { Button, Card } from "@veriworkly/ui";

import type { ApiKeyStatus } from "../../api-key-service";

type ApiKeyDetailActionsProps = {
  status: ApiKeyStatus;
  onDelete: () => void;
  onRevoke: () => void;
  onRotate: () => void;
};

export function ApiKeyDetailActions({
  status,
  onDelete,
  onRevoke,
  onRotate,
}: ApiKeyDetailActionsProps) {
  const canRevoke = status === "active" || status === "expired";

  return (
    <Card className="rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Actions</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {status === "active"
              ? "Replace the secret, cut off access, or remove this key."
              : "This key can no longer authenticate. Create a new key, or remove this one."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* The server refuses to rotate an expired key; a new key replaces it. */}
        {status === "active" && (
          <Button onClick={onRotate} className="w-full">
            <RotateCw className="mr-2 h-4 w-4" /> Rotate
          </Button>
        )}

        {canRevoke && (
          <Button
            variant="secondary"
            className="w-full border border-amber-500/20 bg-amber-50/70 text-amber-700 hover:bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
            onClick={onRevoke}
          >
            <Ban className="mr-2 h-4 w-4" /> Revoke
          </Button>
        )}

        <Button
          variant="secondary"
          className="w-full border border-red-500/20 bg-red-50/70 text-red-700 hover:bg-red-50 dark:bg-red-500/10 dark:text-red-300"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>
    </Card>
  );
}
