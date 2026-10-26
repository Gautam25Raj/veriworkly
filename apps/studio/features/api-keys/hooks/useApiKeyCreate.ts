"use client";

import type { FormEvent } from "react";

import { toast } from "sonner";
import { useMemo, useState } from "react";

import type { GeneratedApiKeyRecord } from "../components/ApiKeyTypes";

import { API_KEY_SCOPE_OPTIONS, AVAILABLE_API_KEY_SCOPES } from "../components/ApiKeyScopes";

import {
  API_KEY_DEFAULT_RATE_LIMIT,
  apiKeyErrorMessage,
  buildCreateApiKeyPayload,
  createApiKey,
} from "../api-key-service";

import { useUserStore } from "@/store/useUserStore";

const DEFAULT_SELECTED_SCOPES = ["user:read"];

export function useApiKeyCreate() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(API_KEY_DEFAULT_RATE_LIMIT);

  const [copied, setCopied] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const [creating, setCreating] = useState(false);

  const [generatedKey, setGeneratedKey] = useState<GeneratedApiKeyRecord | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SELECTED_SCOPES);

  // While the one-time secret is on screen the form is locked, so a second submit cannot
  // replace it before it was copied.
  const locked = creating || generatedKey !== null;

  const selectedScopeDetails = useMemo(
    () => API_KEY_SCOPE_OPTIONS.filter((scope) => selectedScopes.includes(scope.value)),
    [selectedScopes],
  );

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  const resetScopes = () => setSelectedScopes(DEFAULT_SELECTED_SCOPES);
  const selectAllScopes = () => setSelectedScopes([...AVAILABLE_API_KEY_SCOPES]);

  const createKey = async (event: FormEvent) => {
    event.preventDefault();

    if (!isLoggedIn) {
      toast.error("Sign in to create an API key.");
      return;
    }

    if (locked || !name.trim() || selectedScopes.length === 0) return;

    try {
      setCreating(true);
      const data = await createApiKey(
        buildCreateApiKeyPayload({ name, scopes: selectedScopes, rateLimit, expiresAt }),
      );

      setGeneratedKey(data);

      toast.success("API key created.");
    } catch (error) {
      toast.error(apiKeyErrorMessage(error, "Failed to create API key."));
    } finally {
      setCreating(false);
    }
  };

  const copyGeneratedKey = async () => {
    if (!generatedKey) return;

    try {
      await navigator.clipboard.writeText(generatedKey.key);

      setCopied(true);

      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy API key.");
    }
  };

  return {
    creating,
    locked,
    copied,
    name,
    rateLimit,
    expiresAt,
    selectedScopes,
    selectedScopeDetails,
    generatedKey,
    canSubmit: Boolean(isLoggedIn && name.trim() && selectedScopes.length > 0 && !locked),
    setName,
    setRateLimit,
    setExpiresAt,
    setGeneratedKey,
    toggleScope,
    selectAllScopes,
    resetScopes,
    createKey,
    copyGeneratedKey,
  };
}
