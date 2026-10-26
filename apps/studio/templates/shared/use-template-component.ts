"use client";

import type { ComponentType } from "react";

import { createElement, useEffect, useMemo, useState } from "react";

/**
 * Resolves a lazily-loaded template renderer for `templateId`. `null` skips loading.
 *
 * Returns `null` until the module has been fetched, so callers render nothing (or a
 * placeholder) for the first frame after a template switch. The registry memoizes
 * resolved components, so switching back is immediate.
 *
 * When the chunk cannot be fetched (offline, or a deploy replaced it while the page was
 * open) the result is a small component that says so and retries, instead of a preview
 * that silently stays blank. The registry drops a failed load from its cache, so a retry
 * fetches again.
 */
export function useTemplateComponent<TProps>(
  load: (id: string | undefined) => Promise<ComponentType<TProps>>,
  templateId: string | undefined | null,
): ComponentType<TProps> | null {
  const [state, setState] = useState<{
    component: ComponentType<TProps> | null;
    failed: boolean;
  }>({ component: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (templateId === null) return;

    let cancelled = false;

    load(templateId)
      .then((component) => {
        if (!cancelled) setState({ component, failed: false });
      })
      .catch((error: unknown) => {
        console.error("Template could not be loaded", error);
        if (!cancelled) setState({ component: null, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [load, templateId, attempt]);

  // Stable identity, so a re-render does not remount it.
  const fallback = useMemo(
    () =>
      function TemplateLoadFailed() {
        return createElement(
          "div",
          { role: "alert", className: "text-muted grid place-items-center gap-3 p-8 text-sm" },
          "This template could not be loaded. Check your connection and try again.",
          createElement(
            "button",
            {
              type: "button",
              className: "text-foreground underline underline-offset-4",
              onClick: () => setAttempt((value) => value + 1),
            },
            "Try again",
          ),
        );
      },
    [],
  );

  return state.failed ? (fallback as ComponentType<TProps>) : state.component;
}
