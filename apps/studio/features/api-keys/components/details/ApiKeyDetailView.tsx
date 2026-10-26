"use client";

import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ConfirmDialog from "@/components/modals/ConfirmDialog";

import type { ApiKeyDetailRecord } from "../ApiKeyTypes";

import { apiKeyHref, getApiKeyStatus } from "../../api-key-service";
import { useApiKeyActions } from "../../hooks/useApiKeyActions";

import summarizeApiKeyScopes from "../ApiKeyScopes";
import ApiKeyRotateModal from "../ApiKeyRotateModal";
import GeneratedApiKeyCard from "../GeneratedApiKeyCard";

import { ApiKeyDetailActions } from "./ApiKeyDetailActions";
import { ApiKeyDetailHeader } from "./ApiKeyDetailHeader";
import { ApiKeyDetailOverview } from "./ApiKeyDetailOverview";
import { ApiKeyDetailScopes } from "./ApiKeyDetailScopes";

type RevealedKey = { id: string; key: string };

/**
 * A rotate moves to the new key's page, which is a new route segment and remounts this view.
 * The one-time secret is handed across in memory only, and dropped once that page has it.
 */
let rotatedKeyHandoff: RevealedKey | null = null;

export default function ApiKeyDetailView({ initialData }: { initialData: ApiKeyDetailRecord }) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<ApiKeyDetailRecord>(initialData);
  const [generatedKey, setGeneratedKey] = useState<RevealedKey | null>(() =>
    rotatedKeyHandoff?.id === initialData.id ? rotatedKeyHandoff : null,
  );

  useEffect(() => {
    if (rotatedKeyHandoff?.id === initialData.id) rotatedKeyHandoff = null;
  }, [initialData.id]);

  const status = getApiKeyStatus(data);
  const scopeSummary = useMemo(() => summarizeApiKeyScopes(data.scopes), [data.scopes]);

  const actions = useApiKeyActions({
    onRotated: (rotated) => {
      const revealed = { id: rotated.id, key: rotated.key };

      rotatedKeyHandoff = revealed;
      setData(rotated);
      setGeneratedKey(revealed);
      router.replace(apiKeyHref(rotated.id));
    },
    onRevoked: () => {
      setData((prev) => ({ ...prev, isActive: false, revokedAt: new Date().toISOString() }));
      router.refresh();
    },
    onDeleted: () => {
      router.push("/api-keys");
      router.refresh();
    },
  });

  const handleCopy = async () => {
    if (!generatedKey) return;

    try {
      await navigator.clipboard.writeText(generatedKey.key);
      setCopied(true);
      toast.success("API key copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy API key.");
    }
  };

  return (
    <main className="space-y-6" aria-labelledby="api-key-detail-title">
      <ApiKeyDetailHeader data={data} status={status} />

      {generatedKey && (
        <GeneratedApiKeyCard
          generatedKey={generatedKey.key}
          copied={copied}
          onCopy={handleCopy}
          onDismiss={() => setGeneratedKey(null)}
        />
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <ApiKeyDetailOverview data={data} status={status} />
          <ApiKeyDetailActions
            status={status}
            onDelete={() => actions.setDeleteTarget(data)}
            onRevoke={() => actions.setRevokeTarget(data)}
            onRotate={() => actions.setRotateTarget(data)}
          />
        </div>

        <ApiKeyDetailScopes scopes={data.scopes} scopeSummary={scopeSummary} />
      </section>

      <ApiKeyRotateModal
        keyRecord={actions.rotateTarget}
        open={Boolean(actions.rotateTarget)}
        submitting={actions.rotateSubmitting}
        onSubmitAction={actions.rotateKey}
        onCloseAction={() => actions.setRotateTarget(null)}
      />

      <ConfirmDialog
        tone="warning"
        title="Revoke API key?"
        confirmLabel="Revoke key"
        onConfirm={actions.revokeKey}
        loading={actions.revokeSubmitting}
        open={Boolean(actions.revokeTarget)}
        onClose={() => actions.setRevokeTarget(null)}
        description="This disables the key immediately while keeping the record for audit and history."
      />

      <ConfirmDialog
        tone="destructive"
        confirmPhrase="DELETE"
        title="Delete API key?"
        cancelLabel="Keep API key"
        loading={actions.deleteSubmitting}
        open={Boolean(actions.deleteTarget)}
        onConfirm={actions.deleteKey}
        onClose={() => actions.setDeleteTarget(null)}
        warningText="This action permanently deletes the key from the database."
        description="Use this only when you no longer need the key at all. Permanent deletion cannot be undone."
      />
    </main>
  );
}
