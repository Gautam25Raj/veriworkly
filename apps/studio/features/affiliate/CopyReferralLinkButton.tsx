"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@veriworkly/ui";

export function CopyReferralLinkButton({ affiliateCode }: { affiliateCode: string | null }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        if (!affiliateCode) return;

        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/login?ref=${affiliateCode}`,
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Could not copy the link. Copy it manually instead.");
        }
      }}
    >
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : "Copy referral link"}
    </Button>
  );
}
