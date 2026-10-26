import { toast } from "sonner";

import { ApiRequestError, fetchApiData } from "@/utils/fetchApiData";

const REFERRAL_STORAGE_KEY = "veriworkly:referral";

/** Matches the server's attribution window: a code is refused on accounts older than 30 days. */
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Kept from the click on `/login?ref=…` until the first sign-in, however far away that is: the
 * visitor may continue as a guest and sign in days later from a bare `/login`.
 */
export function rememberReferralCode(code: string, now = new Date()) {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code, savedAt: now.getTime() }));
  } catch (error) {
    // Storage blocked (private mode, quota): this visit can still sign in, just unattributed.
    console.warn("Could not remember the referral code.", error);
  }
}

export function readReferralCode(now = new Date()): string | null {
  const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const { code, savedAt } = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };

    if (
      typeof code === "string" &&
      typeof savedAt === "number" &&
      now.getTime() - savedAt <= REFERRAL_TTL_MS
    ) {
      return code;
    }
  } catch {
    // Unreadable entry: dropped below like an expired one.
  }

  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  return null;
}

/**
 * The work every sign-in path (email code, social callback) does once the session exists.
 *
 * It deliberately leaves sync alone: `/users/me.autoSyncEnabled` is the user's choice (on by
 * default for a new account) and `AuthInitializer` applies it on the next render. Forcing it on
 * here overrode every saved opt-out and uploaded the device's documents.
 *
 * A remembered referral is applied once. The server's refusal (too old, already purchased) is
 * returned for the caller to show and the code is dropped; a network or server failure keeps it
 * for the next sign-in.
 */
export async function finishSignIn(now = new Date()): Promise<{ referralError?: string }> {
  const code = readReferralCode(now);
  if (!code) return {};

  try {
    await fetchApiData("/affiliates/referral", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status < 500) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }

    return {
      referralError: error instanceof Error ? error.message : "The referral could not be applied.",
    };
  }

  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  return {};
}

function signInHref() {
  const here = `${window.location.pathname}${window.location.search}`;

  return `/login?callbackURL=${encodeURIComponent(here)}`;
}

/** For an action a guest cannot take: says why and offers the way in, back to this page. */
export function toastSignInRequired(message: string) {
  toast.error(message, {
    action: { label: "Sign in", onClick: () => window.location.assign(signInHref()) },
  });
}
