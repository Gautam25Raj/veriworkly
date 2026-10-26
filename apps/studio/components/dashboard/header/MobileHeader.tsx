import Link from "next/link";
import Image from "next/image";
import { Menu as MenuIcon, Plus, X } from "lucide-react";

import { Button } from "@veriworkly/ui";

interface MobileHeaderProps {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
  onOpenNewDocument: () => void;
}

export function MobileHeader({
  mobileNavOpen,
  onToggleMobileNav,
  onOpenNewDocument,
}: MobileHeaderProps) {
  return (
    <header className="border-border/70 bg-background/90 sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-3" aria-label="VeriWorkly dashboard">
        <Image
          preload
          width={36}
          height={36}
          alt="VeriWorkly"
          src="/veriworkly-logo.png"
          className="h-9 w-9 rounded-xl object-contain"
        />
        <span className="font-extrabold">VeriWorkly</span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Labelled in words: on a phone this is the only create control in the chrome. */}
        <Button
          size="sm"
          variant="primary"
          onClick={onOpenNewDocument}
          aria-label="New document"
          className="h-10 gap-1.5 rounded-xl px-3"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New</span>
        </Button>

        <button
          type="button"
          aria-expanded={mobileNavOpen}
          aria-label="Toggle navigation"
          onClick={onToggleMobileNav}
          className="border-border bg-card text-foreground flex h-10 w-10 items-center justify-center rounded-xl border"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
