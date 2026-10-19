"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A shell command with a copy button, for install lines. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the command stays selectable.
    }
  };

  return (
    <div className="border-border/80 bg-card/60 flex w-full max-w-md items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-5 shadow-xs backdrop-blur-md">
      <span className="text-muted font-mono text-xs select-none" aria-hidden="true">
        $
      </span>
      <code className="text-foreground min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy "${command}"`}
        className="text-muted hover:text-foreground hover:bg-background focus-visible:ring-accent inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

export default CopyCommand;
