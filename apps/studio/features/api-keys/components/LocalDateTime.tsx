"use client";

import { useSyncExternalStore } from "react";

import { tomorrowLocalDateInput } from "@/lib/local-date";

const subscribeNever = () => () => {};

/**
 * Locale and time zone exist only in the browser, so the server renders the UTC value and React
 * swaps in the local text after hydration instead of reporting a mismatch.
 */
export function LocalDateTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const text = useSyncExternalStore(
    subscribeNever,
    () =>
      dateOnly
        ? new Date(iso).toLocaleDateString()
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(iso),
          ),
    () =>
      dateOnly
        ? new Date(iso).toISOString().slice(0, 10)
        : new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC",
  );

  return <time dateTime={iso}>{text}</time>;
}

/** Tomorrow in the user's time zone, as a date input's `min`; unset during server rendering. */
export function useTomorrowDateInput() {
  return useSyncExternalStore(subscribeNever, tomorrowLocalDateInput, () => undefined);
}
