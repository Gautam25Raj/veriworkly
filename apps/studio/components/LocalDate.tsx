"use client";

import { useSyncExternalStore } from "react";

import { tomorrowLocalDateInput } from "@/lib/local-date";

const subscribeNever = () => () => {};

/**
 * A date in the reader's own locale and timezone. The server knows neither, so it renders the
 * UTC date and the client swaps in local time right after hydration instead of mismatching.
 */
export function LocalDate({ value, withTime = false }: { value: string; withTime?: boolean }) {
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const options: Intl.DateTimeFormatOptions = withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" };

  return (
    <time dateTime={value}>
      {isClient
        ? new Date(value).toLocaleString(undefined, options)
        : new Date(value).toLocaleString("en-US", { ...options, timeZone: "UTC" })}
    </time>
  );
}

/** Tomorrow in the user's time zone, as a date input's `min`; unset during server rendering. */
export function useTomorrowDateInput() {
  return useSyncExternalStore(subscribeNever, tomorrowLocalDateInput, () => undefined);
}
