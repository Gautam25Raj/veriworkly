import type { CatalogProduct, ProductKey } from "@/features/billing/types";
import { ApiRequestError } from "@/utils/fetchApiData";

export const PAYMENTS_OPEN_SOON =
  "Payments open soon. Purchases are not available yet; nothing has been charged.";

/**
 * Payments are admin-only at launch: the API answers every purchase from anyone else with 403
 * (`assertPaymentsEnabled`). A signed-out buyer gets 401, so 403 on a purchase means only this.
 */
export function isPaymentsClosedError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 403;
}

/** The second 409 a checkout can answer, next to the checkout-lock one. */
export function isAlreadySubscribedError(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    error.status === 409 &&
    error.message.includes("already have an active subscription")
  );
}

export type CheckoutInterval = keyof CatalogProduct["prices"];

const INTERVAL_LABELS: Record<CheckoutInterval, string> = {
  one_day: "for 3 days",
  seven_day: "for 7 days",
  monthly: "per month",
  annual: "per year",
};

/** One-time passes are sold under the bundle key; customers know them by these names. */
const PASS_NAMES: Partial<Record<CheckoutInterval, string>> = {
  one_day: "3-Day Sprint pass",
  seven_day: "7-Day Hunt pass",
};

export function formatPrice(cents: number, currency: CatalogProduct["currency"] = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export type CheckoutRequest =
  | {
      ok: true;
      productKey: ProductKey;
      interval: CheckoutInterval;
      productName: string;
      priceLabel: string;
    }
  | { ok: false; reason: string };

/**
 * A `/checkout` link names exactly what it sells. A missing or unknown product or interval is
 * refused rather than defaulted: a default silently turned `?productKey=ai_credits` into an
 * annual charge, and a missing product into the most expensive bundle.
 */
export function resolveCheckoutRequest(
  params: { productKey?: string; interval?: string },
  catalog: CatalogProduct[],
): CheckoutRequest {
  const product = catalog.find((item) => item.key === params.productKey);
  if (!product) return { ok: false, reason: "This checkout link does not name a plan we sell." };

  const interval = Object.hasOwn(INTERVAL_LABELS, params.interval ?? "")
    ? (params.interval as CheckoutInterval)
    : null;
  const priceCents = interval ? product.prices[interval] : undefined;

  if (!interval || priceCents === undefined) {
    return { ok: false, reason: `${product.name} is not sold for that billing period.` };
  }

  return {
    ok: true,
    productKey: product.key,
    interval,
    productName: PASS_NAMES[interval] ?? product.name,
    priceLabel: `${formatPrice(priceCents, product.currency)} ${INTERVAL_LABELS[interval]}`,
  };
}
