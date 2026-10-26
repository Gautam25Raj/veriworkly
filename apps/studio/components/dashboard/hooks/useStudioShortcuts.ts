"use client";

import { useEffect, useEffectEvent } from "react";

interface StudioShortcutsOptions {
  onOpenSearch: () => void;
  onOpenImport: (provider?: "linkedin" | "github") => void;
}

/**
 * Callers pass fresh closures every render; effect events read the latest ones, so the
 * window listeners are bound once for the shell's lifetime instead of on every render.
 */
export function useStudioShortcuts({ onOpenSearch, onOpenImport }: StudioShortcutsOptions) {
  const openSearch = useEffectEvent(() => onOpenSearch());
  const openImport = useEffectEvent(() => onOpenImport("linkedin"));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };

    const handleOpenImportEvent = () => openImport();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-import-profile", handleOpenImportEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-import-profile", handleOpenImportEvent);
    };
  }, []);
}
