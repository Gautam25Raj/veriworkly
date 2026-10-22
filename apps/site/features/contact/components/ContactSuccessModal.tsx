import React, { useRef } from "react";
import { Check, X } from "lucide-react";

import { useFocusTrap } from "@/hooks/use-focus-trap";

export interface ContactSuccessData {
  name: string;
  email: string;
  subject: string;
  timestamp: string;
}

interface ContactSuccessModalProps {
  data: ContactSuccessData | null;
  onClose: () => void;
}

export const ContactSuccessModal = ({ data, onClose }: ContactSuccessModalProps) => {
  const successDialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(data !== null, successDialogRef, {
    onEscape: onClose,
  });

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        ref={successDialogRef}
        aria-labelledby="contact-success-title"
        className="animate-scale-in bg-card relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="text-muted hover:text-foreground hover:bg-background focus-visible:ring-accent/40 absolute top-4 right-4 flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="size-4" />
        </button>

        <div className="flex flex-col items-start gap-3 px-7 pt-8 pb-2">
          <span className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
            <Check className="size-6 stroke-[2.5]" aria-hidden="true" />
          </span>

          <h2
            id="contact-success-title"
            className="text-foreground text-2xl font-bold tracking-tight text-balance"
          >
            Message sent.
          </h2>

          <p className="text-muted text-base leading-7">
            Thank you, {data.name}. Your note has landed directly in our team inbox.
          </p>
        </div>

        <div className="bg-background m-7 space-y-2.5 rounded-2xl p-5 text-base">
          <div className="flex justify-between gap-4">
            <span className="text-muted">From</span>
            <span className="text-foreground truncate text-right font-semibold">{data.email}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-muted">Subject</span>
            <span className="text-foreground max-w-[65%] truncate text-right font-semibold">
              {data.subject}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-muted">Sent</span>
            <span className="text-muted text-right tabular-nums">
              {new Date(data.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-7 pb-7">
          <p className="text-muted text-base leading-7">
            We typically reply within <strong className="text-foreground">24 to 48 hours</strong>. A
            confirmation receipt is on its way to your inbox.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="bg-foreground text-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent/40 flex h-12 w-full cursor-pointer items-center justify-center rounded-full text-base font-semibold transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
          >
            Back to VeriWorkly
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactSuccessModal;
