"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

function isApplePlatform() {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform;

  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * A Ctrl/Cmd shortcut written the way the reader's keyboard labels it: "⌘K" on Apple devices,
 * "Ctrl K" elsewhere. The server cannot know the platform, so it renders "Ctrl K" and the
 * client swaps in "⌘K" after hydration instead of mismatching.
 */
export function ShortcutKey({ letter }: { letter: string }) {
  const apple = useSyncExternalStore(subscribeNever, isApplePlatform, () => false);

  return <>{apple ? `⌘${letter}` : `Ctrl ${letter}`}</>;
}
