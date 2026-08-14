"use client";

import { AlertTriangle } from "lucide-react";

import { Modal, Button } from "@veriworkly/ui";

interface ConfirmModalProps {
  open: boolean;
  onCloseAction: () => void;
  onConfirmAction: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
}

/**
 * A plain yes/no confirmation for destructive-but-local actions.
 *
 * Distinct from `DestructiveModal`, which requires typing a verification word and warns
 * about data being "purged from our servers" — right for deleting a document, wrong for
 * "reset this draft to defaults". Those actions previously had no confirmation at all
 * because the only available dialog was too heavy for them.
 */
const ConfirmModal = ({
  open,
  onCloseAction,
  onConfirmAction,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
}: ConfirmModalProps) => {
  return (
    <Modal open={open} onClose={onCloseAction}>
      <Modal.Content className="overflow-hidden p-0">
        <div className="border-border/60 flex items-center gap-3 border-b p-4">
          <div className="bg-warning/10 text-warning flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>

          <Modal.Title className="text-foreground min-w-0 flex-1 text-base font-semibold">
            {title}
          </Modal.Title>
        </div>

        <Modal.Body className="p-4">
          <p className="text-muted text-sm leading-relaxed">{description}</p>
        </Modal.Body>

        <div className="flex flex-col-reverse gap-2 border-t bg-zinc-50/50 p-4 sm:flex-row sm:justify-end dark:bg-zinc-900/50">
          <Button
            size="sm"
            onClick={onCloseAction}
            variant="secondary"
            className="w-full text-xs sm:w-auto"
          >
            {cancelLabel}
          </Button>

          <Button
            size="sm"
            loading={loading}
            onClick={onConfirmAction}
            variant="primary"
            className="w-full text-xs sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal.Content>
    </Modal>
  );
};

export default ConfirmModal;
