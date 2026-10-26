"use client";

import { toast } from "sonner";
import { useState } from "react";

import type { ApiKeyRecord, GeneratedApiKeyRecord } from "../components/ApiKeyTypes";

import {
  apiKeyErrorMessage,
  deleteApiKey,
  revokeApiKey,
  rotateApiKey,
  type ApiKeyRotatePayload,
} from "../api-key-service";

type UseApiKeyActionsOptions = {
  onRotated: (rotated: GeneratedApiKeyRecord) => void;
  onRevoked: (revoked: ApiKeyRecord) => void;
  onDeleted: (deleted: ApiKeyRecord) => void;
};

/** Rotate, revoke and delete with their confirm targets, shared by the key list and detail page. */
export function useApiKeyActions({ onRotated, onRevoked, onDeleted }: UseApiKeyActionsOptions) {
  const [rotateTarget, setRotateTarget] = useState<ApiKeyRecord | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null);

  const [rotateSubmitting, setRotateSubmitting] = useState(false);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const rotateKey = async (payload: ApiKeyRotatePayload) => {
    if (!rotateTarget) return;

    try {
      setRotateSubmitting(true);

      const rotated = await rotateApiKey(rotateTarget.id, payload);

      setRotateTarget(null);
      toast.success("API key rotated.");
      onRotated(rotated);
    } catch (error) {
      toast.error(apiKeyErrorMessage(error, "Failed to rotate API key."));
    } finally {
      setRotateSubmitting(false);
    }
  };

  const revokeKey = async () => {
    if (!revokeTarget) return;

    try {
      setRevokeSubmitting(true);

      await revokeApiKey(revokeTarget.id);

      setRevokeTarget(null);
      toast.success("API key revoked.");
      onRevoked(revokeTarget);
    } catch (error) {
      toast.error(apiKeyErrorMessage(error, "Failed to revoke API key."));
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const deleteKey = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteSubmitting(true);

      await deleteApiKey(deleteTarget.id);

      setDeleteTarget(null);
      toast.success("API key deleted.");
      onDeleted(deleteTarget);
    } catch (error) {
      toast.error(apiKeyErrorMessage(error, "Failed to delete API key."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return {
    rotateTarget,
    revokeTarget,
    deleteTarget,
    rotateSubmitting,
    revokeSubmitting,
    deleteSubmitting,
    setRotateTarget,
    setRevokeTarget,
    setDeleteTarget,
    rotateKey,
    revokeKey,
    deleteKey,
  };
}
