"use client";

import { backendApiUrl } from "@/lib/backend";
import { siteConfig } from "@/config/site";

let cleanupPromise: Promise<void> | null = null;

function isInvalidSessionResponse(path: string, status: number) {
  return status === 401 || (status === 404 && path.split("?")[0] === "/users/me");
}

async function clearInvalidSessionAndRedirect() {
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try {
      await fetch(backendApiUrl("/auth/sign-out"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      const loginUrl = `${siteConfig.links.app}/login`;
      window.location.replace(
        `${loginUrl}?callbackURL=${encodeURIComponent(window.location.href)}`,
      );
    }
  })();

  return cleanupPromise;
}

const DEFAULT_TIMEOUT_MS = 15000;

export async function authenticatedFetch(path: string, init?: RequestInit) {
  // Only time out requests that didn't already bring their own abort signal
  // — a hung backend used to leave callers (editor saves, AI generation,
  // asset uploads) waiting indefinitely with no feedback.
  const controller = init?.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS) : null;

  try {
    const response = await fetch(backendApiUrl(path), {
      credentials: "include",
      ...init,
      signal: init?.signal ?? controller?.signal,
    });

    if (isInvalidSessionResponse(path, response.status)) {
      await clearInvalidSessionAndRedirect();
    }

    return response;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
