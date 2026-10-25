"use client";

import type { ChangeEvent } from "react";

import { useCallback, useRef } from "react";

/**
 * Wiring for a file `<input>` that is opened programmatically and handled asynchronously.
 *
 * The input element is captured before the first `await`: React clears
 * `event.currentTarget` once dispatch finishes, so reading it after the import resolved
 * threw, and the value was never cleared — choosing the same file again fired no `change`
 * event at all. The value is cleared after the work settles, whether it succeeded or not.
 */
export function useHiddenFileInput(onFile: (file: File) => Promise<void> | void) {
  const ref = useRef<HTMLInputElement>(null);

  const onChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];

      if (!file) return;

      try {
        await onFile(file);
      } finally {
        input.value = "";
      }
    },
    [onFile],
  );

  const open = useCallback(() => ref.current?.click(), []);

  return { ref, onChange, open };
}
