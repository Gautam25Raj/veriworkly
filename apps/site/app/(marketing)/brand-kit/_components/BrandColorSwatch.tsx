"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Card } from "@veriworkly/ui";

interface BrandColorSwatchProps {
  name: string;
  hex: string;
  variable: string;
  description: string;
}

const BrandColorSwatch = ({ name, hex, variable, description }: BrandColorSwatchProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser — fail silently, hex is still visible.
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="h-24 w-full" style={{ backgroundColor: hex }} />

      <div className="space-y-1 p-4">
        <p className="text-foreground font-semibold">{name}</p>

        <button
          type="button"
          onClick={handleCopy}
          className="text-muted hover:text-foreground group flex items-center gap-1.5 font-mono text-xs uppercase transition-colors"
          aria-label={`Copy ${hex} to clipboard`}
        >
          {hex}
          {copied ? (
            <Check className="text-emerald-500 size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          )}
        </button>

        <p className="text-muted font-mono text-[10px]">{variable}</p>
        <p className="text-muted mt-2 text-xs leading-relaxed">{description}</p>
      </div>
    </Card>
  );
};

export default BrandColorSwatch;
