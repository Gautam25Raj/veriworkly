import type { BillingSummary } from "@/features/billing/types";

import { fetchApiData } from "@/utils/fetchApiData";

const BASELINE_KEY = "veriworkly:checkout-baseline";

/** What a purchase can change: a plan or pass grants entitlements, a credit pack credits. */
export function purchaseFingerprint(billing: BillingSummary | null): string {
  return JSON.stringify([
    billing?.plan,
    billing?.activeProductKeys,
    billing?.entitlements,
    billing?.credits.balance,
  ]);
}

/**
 * Records the account's state just before the payment page opens.
 *
 * The billing page cannot use the summary it was rendered with as the "before": when the
 * webhook lands ahead of the redirect back, that summary already shows the purchase, and
 * waiting for it to change would wait forever.
 */
export function rememberPurchaseBaseline(productKey: string, billing: BillingSummary) {
  try {
    sessionStorage.setItem(
      BASELINE_KEY,
      JSON.stringify({ productKey, fingerprint: purchaseFingerprint(billing) }),
    );
  } catch {
    // Without storage the return falls back to one refresh, which shows the plan as it is.
  }
}

/** The recorded state, removed as it is read so a later visit does not reuse it. */
export function takePurchaseBaseline(): string | null {
  try {
    const raw = sessionStorage.getItem(BASELINE_KEY);
    sessionStorage.removeItem(BASELINE_KEY);

    const parsed = raw ? (JSON.parse(raw) as { fingerprint?: unknown }) : null;
    return typeof parsed?.fingerprint === "string" ? parsed.fingerprint : null;
  } catch {
    return null;
  }
}

/**
 * Reads the account's current state and records it as the baseline, just before checkout
 * opens. A failed read records nothing (and drops an older record), so the return falls back
 * to one refresh instead of comparing against a state that may already include the purchase.
 * Never throws: checkout must still open without a baseline.
 */
export async function recordPurchaseBaseline(productKey: string): Promise<void> {
  try {
    rememberPurchaseBaseline(
      productKey,
      await fetchApiData<BillingSummary>("/billing/me", { method: "GET" }),
    );
  } catch {
    takePurchaseBaseline();
  }
}
