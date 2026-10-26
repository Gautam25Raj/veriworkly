import { backendApiUrl } from "@/lib/constants";

let cleanupPromise: Promise<void> | null = null;

export function isInvalidSessionResponse(path: string, status: number) {
  const pathname = path.split("?")[0];

  // A public share answers 401 to anyone, signed in or not; it says nothing about the session.
  if (pathname.startsWith("/shares/public/")) return false;

  return status === 401 || (status === 404 && pathname === "/users/me");
}

export function clearInvalidSessionAndRedirect() {
  if (typeof window === "undefined") return Promise.resolve();
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    // Best effort: the server already rejected this session, and the redirect below is what
    // gets the user out of it whether or not the server hears about it.
    await fetch(backendApiUrl("/auth/sign-out"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => undefined);

    const callbackURL = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  })();

  return cleanupPromise;
}
