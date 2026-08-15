"use client";

import type { ComponentType } from "react";

import { useEffect, useState } from "react";

/**
 * Resolves a lazily-loaded template renderer for `templateId`.
 *
 * Returns `null` until the module has been fetched, so callers render nothing (or a
 * placeholder) for the first frame after a template switch. The registry memoizes
 * resolved components, so switching back is immediate.
 *
 * Shared by the resume and cover letter previews. Both used to solve this
 * differently — the resume with its own effect and `useState`, the cover letter not at
 * all because its templates were statically imported and branched on with an `if`.
 */
export function useTemplateComponent<TProps>(
  load: (id: string | undefined) => Promise<ComponentType<TProps>>,
  templateId: string | undefined,
): ComponentType<TProps> | null {
  const [component, setComponent] = useState<ComponentType<TProps> | null>(null);

  useEffect(() => {
    let cancelled = false;

    load(templateId)
      .then((resolved) => {
        // Store via the updater form: a component is itself a function, so passing it
        // directly to setState would be treated as a state updater and invoked.
        if (!cancelled) setComponent(() => resolved);
      })
      .catch(() => {
        if (!cancelled) setComponent(null);
      });

    return () => {
      cancelled = true;
    };
  }, [load, templateId]);

  return component;
}
