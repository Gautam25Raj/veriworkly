"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface PillBox {
  x: number;
  width: number;
  /** Appearing, not moving: place it without a slide. */
  instant: boolean;
}

/**
 * A highlight that slides to the hovered item and rests on the active one, in place of
 * framer's layoutId. Nothing is measured until the first hover, so page load does no layout
 * reads; until then (`engaged` false) callers show their own static active marker.
 */
export function useSlidingPill(activeKey: string | null) {
  const items = useRef(new Map<string, HTMLElement>());
  const [hovered, setHovered] = useState<string | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [box, setBox] = useState<PillBox | null>(null);
  const shown = useRef(false);

  const target = engaged ? (hovered ?? activeKey) : null;

  useLayoutEffect(() => {
    const el = target ? items.current.get(target) : undefined;
    if (!el) {
      shown.current = false;
      return;
    }
    const instant = !shown.current;
    shown.current = true;
    setBox({ x: el.offsetLeft, width: el.offsetWidth, instant });
  }, [target]);

  const itemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) items.current.set(key, node);
      else items.current.delete(key);
    },
    [],
  );

  return {
    box,
    engaged,
    hovered,
    visible: target !== null && box !== null,
    itemRef,
    onItemEnter: (key: string) => {
      setEngaged(true);
      setHovered(key);
    },
    onLeave: () => setHovered(null),
  };
}
