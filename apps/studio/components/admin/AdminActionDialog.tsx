"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Modal, TextArea } from "@veriworkly/ui";

import type { ButtonVariant } from "@veriworkly/ui";

export interface AdminActionDialogProps {
  /** Label on the button that opens the dialog. */
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  disabled?: boolean;

  title: string;
  description?: ReactNode;
  /** Extra context rendered above the reason field (the row being acted on, warnings). */
  children?: ReactNode;

  confirmLabel: string;
  confirmVariant?: ButtonVariant;

  /**
   * Requires the operator to retype this exact string before the action can run. Used for
   * irreversible actions (account deletion) where a misclick must not be sufficient.
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;

  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Off for the few endpoints whose reason field is genuinely optional. */
  reasonRequired?: boolean;

  onConfirm: (reason: string) => Promise<unknown>;
}

/**
 * The single confirmation surface for destructive and semi-destructive admin actions.
 *
 * It exists because every admin mutation on the server demands an audit reason, and a bare
 * `onClick` handler gives the operator nowhere to type one. Bundling the reason field with
 * the confirmation step means the audit trail is populated by construction rather than by
 * whoever remembered to add a prompt.
 */
const AdminActionDialog = ({
  trigger,
  triggerVariant = "secondary",
  triggerClassName,
  disabled,
  title,
  description,
  children,
  confirmLabel,
  confirmVariant = "primary",
  confirmPhrase,
  confirmPhraseLabel,
  reasonLabel = "Audit reason",
  reasonPlaceholder = "Why are you doing this? Recorded in the admin audit log.",
  reasonRequired = true,
  onConfirm,
}: AdminActionDialogProps) => {
  const router = useRouter();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reasonSatisfied = !reasonRequired || reason.trim().length >= 3;
  const phraseSatisfied = !confirmPhrase || phrase.trim() === confirmPhrase;

  const close = () => {
    if (pending) return;

    setOpen(false);
    setReason("");
    setPhrase("");
    setError("");
  };

  const submit = async () => {
    if (!reasonSatisfied || !phraseSatisfied) return;

    setPending(true);
    setError("");

    try {
      await onConfirm(reason.trim());

      setOpen(false);
      setReason("");
      setPhrase("");

      // Re-fetch the server component that rendered this row so the table reflects the change.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={triggerVariant}
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>

      <Modal open={open} onClose={close}>
        <Modal.Content titleId={titleId} className="md:max-w-md">
          <Modal.Header>
            <Modal.Title id={titleId}>{title}</Modal.Title>
            {description ? <Modal.Description>{description}</Modal.Description> : null}
          </Modal.Header>

          <Modal.Body className="space-y-4">
            {children}

            <div className="space-y-1.5">
              <label htmlFor={`${titleId}-reason`} className="text-muted text-xs font-medium">
                {reasonLabel}
                {reasonRequired ? <span className="text-destructive"> *</span> : null}
              </label>

              <TextArea
                id={`${titleId}-reason`}
                rows={3}
                value={reason}
                placeholder={reasonPlaceholder}
                onChange={(event) => setReason(event.target.value)}
              />

              {reasonRequired && reason.length > 0 && !reasonSatisfied ? (
                <p className="text-warning text-xs">Give at least 3 characters of context.</p>
              ) : null}
            </div>

            {confirmPhrase ? (
              <div className="space-y-1.5">
                <label htmlFor={`${titleId}-phrase`} className="text-muted text-xs font-medium">
                  {confirmPhraseLabel ?? `Type ${confirmPhrase} to confirm`}
                </label>

                <Input
                  id={`${titleId}-phrase`}
                  inputSize="sm"
                  value={phrase}
                  autoComplete="off"
                  onChange={(event) => setPhrase(event.target.value)}
                />
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="border-destructive/25 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
              >
                {error}
              </p>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="-mx-6 -mb-6 rounded-b-3xl">
            <Button variant="ghost" size="sm" onClick={close} disabled={pending}>
              Cancel
            </Button>

            <Button
              size="sm"
              variant={confirmVariant}
              loading={pending}
              disabled={!reasonSatisfied || !phraseSatisfied}
              onClick={() => void submit()}
            >
              {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </>
  );
};

export default AdminActionDialog;
