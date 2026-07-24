import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { fetchApiData } from "@/utils/fetchApiData";

// Server Component data fetching, authenticated as the visiting user. `fetchApiData` already
// forwards a first-party Origin header when called server-side; the one thing it can't do on its
// own is see the browser's cookies, since Node's fetch has no ambient cookie jar — so we read
// them explicitly from the incoming request via next/headers and forward them along.
export const fetchServerApiData = cache(async function fetchServerApiData<T>(
  path: string,
): Promise<T | null> {
  try {
    const cookieHeader = (await cookies()).toString();

    if (!cookieHeader || !cookieHeader.trim()) return null;

    return await fetchApiData<T>(path, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return null;
  }
});
