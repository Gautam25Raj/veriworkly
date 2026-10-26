"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Calendar, Key, TrendingUp, UserPen, Loader2 } from "lucide-react";

import type { ApiKeyRecord, ApiKeyDetailRecord } from "./ApiKeyTypes";

import { Button, Input, Modal } from "@veriworkly/ui";
import { tomorrowLocalDateInput } from "@/lib/local-date";

import {
  API_KEY_MAX_RATE_LIMIT,
  API_KEY_RATE_WINDOW_LABEL,
  apiKeyErrorMessage,
  buildRotateApiKeyPayload,
  expiryDateInputValue,
  fetchApiKey,
  type ApiKeyRotatePayload,
} from "../api-key-service";

type ApiKeyRotateModalProps = {
  open: boolean;
  keyRecord: ApiKeyRecord | null;
  submitting: boolean;
  onCloseAction: () => void;
  onSubmitAction: (payload: ApiKeyRotatePayload) => void;
};

export default function ApiKeyRotateModal({
  open,
  keyRecord,
  submitting,
  onCloseAction,
  onSubmitAction,
}: ApiKeyRotateModalProps) {
  const [details, setDetails] = useState<ApiKeyDetailRecord | null>(null);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!open || !keyRecord) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setLoadingDetails(true);
      setDetailError("");

      fetchApiKey(keyRecord.id)
        .then((data) => {
          if (cancelled) return;

          setDetails(data);
          setName(data.name);
          setRateLimit(data.rateLimit);
          setExpiresAt(expiryDateInputValue(data.expiresAt));
        })
        .catch((err) => {
          if (cancelled) return;

          setDetailError(apiKeyErrorMessage(err, "Failed to load key details"));
        })
        .finally(() => {
          if (!cancelled) setLoadingDetails(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [open, keyRecord]);

  const currentExpiry = expiryDateInputValue(details?.expiresAt);
  const tomorrow = tomorrowLocalDateInput();
  // A new expiry starts tomorrow; keeping the key's current day, even today, stays allowed.
  const minExpiry = currentExpiry && currentExpiry < tomorrow ? currentExpiry : tomorrow;
  // An admin may have raised this key above the self-serve maximum, and keeping that is allowed.
  const maxRateLimit = Math.max(API_KEY_MAX_RATE_LIMIT, details?.rateLimit ?? 0);

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!details) {
      return;
    }

    onSubmitAction(buildRotateApiKeyPayload(details, { name, rateLimit, expiresAt }));
  };

  const handleClose = () => {
    if (!submitting) {
      onCloseAction();
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Modal.Content className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b px-4 pt-2 pb-4 md:bg-zinc-50/50 md:pt-4 dark:bg-zinc-900/50">
          <div className="ring-offset-background bg-accent/10 ring-accent/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300">
            <ArrowRightLeft className="text-accent h-4.5 w-4.5" />
          </div>

          <div className="min-w-0">
            <Modal.Title>Rotate API Key</Modal.Title>

            {keyRecord ? (
              <p className="text-muted-foreground text-xs font-medium">
                Rotating <span className="text-foreground font-mono">{keyRecord.keyPrefix}...</span>
              </p>
            ) : null}
          </div>
        </div>

        {loadingDetails ? (
          <div className="flex justify-center py-12">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : detailError ? (
          <div className="p-6 text-center text-sm text-red-500">{detailError}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="grid gap-4 px-4 sm:grid-cols-1">
              <div className="space-y-1.5">
                <label
                  htmlFor="rotate-api-key-name"
                  className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                >
                  <UserPen className="h-3.5 w-3.5" /> Key name
                </label>

                <Input
                  value={name}
                  inputSize="sm"
                  disabled={submitting}
                  id="rotate-api-key-name"
                  className="bg-background/50 h-9"
                  placeholder="Documentation token"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 px-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="rotate-api-key-rate-limit"
                  className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Requests per {API_KEY_RATE_WINDOW_LABEL}
                </label>

                <Input
                  required
                  min={1}
                  step={1}
                  max={maxRateLimit}
                  type="number"
                  inputSize="sm"
                  value={rateLimit || ""}
                  disabled={submitting}
                  id="rotate-api-key-rate-limit"
                  className="bg-background/50 h-9"
                  onChange={(event) => setRateLimit(Number(event.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="rotate-api-key-expires-at"
                  className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                >
                  <Calendar className="h-3.5 w-3.5" /> Expires at end of
                </label>

                <Input
                  type="date"
                  inputSize="sm"
                  min={minExpiry}
                  value={expiresAt}
                  disabled={submitting}
                  className="bg-background/50 h-9"
                  id="rotate-api-key-expires-at"
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <div className="border-border/70 bg-muted/10 text-muted-foreground mx-4 rounded-xl border p-3 text-xs">
              <div className="flex items-start gap-2">
                <Key className="text-accent mt-0.5 h-4 w-4 shrink-0" />

                <p>
                  The old key is revoked as soon as this replacement is created. Share the new key
                  only after copying it securely.
                </p>
              </div>
            </div>

            <Modal.Footer>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                type="submit"
                loading={submitting}
                disabled={!details}
                className="w-full sm:w-auto"
              >
                Generate Key
              </Button>
            </Modal.Footer>
          </form>
        )}
      </Modal.Content>
    </Modal>
  );
}
