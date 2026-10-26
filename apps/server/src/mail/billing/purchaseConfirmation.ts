import { getBaseLayout, escapeHtml } from "../shared/layout.js";

import { formatDate, formatMoney, summaryTable } from "./billingFormat.js";

/**
 * What a purchase confirmation repeats back to the customer (V-177; the site's Terms promise a
 * confirmation that restates the terms): the product by its real name, what was paid, how long
 * it lasts and, for a subscription, when and at what price it renews.
 */
export type PurchaseConfirmation = {
  kind: "subscription" | "pass" | "credit_pack";
  productName: string;
  /** In the currency's minor unit; null when the provider did not report it. */
  amountCents: number | null;
  currency: string | null;
  /** True when the amount is the plan's price before tax rather than the charge itself. */
  amountExcludesTax: boolean;
  /** Pass end, credit expiry, or the end of the subscription period just paid for. */
  accessEndsAt: Date | null;
  /** Subscriptions only: the next charge. */
  renewsAt: Date | null;
  billingPeriod: "month" | "year" | null;
  /** Credits this purchase adds at once (pack, pass); null when none or when they come later. */
  credits: number | null;
  /** How a plan's credits arrive (monthly allowance, annual monthly grants). */
  creditsNote: string | null;
};

function priceText(details: PurchaseConfirmation): string | null {
  if (details.amountCents === null || !details.currency) return null;
  const price = formatMoney(details.amountCents, details.currency);
  return details.amountExcludesTax ? `${price} (before any tax)` : price;
}

/** The facts, in order, as label/value pairs: used for both the HTML table and the text body. */
export function purchaseConfirmationRows(details: PurchaseConfirmation): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Purchase", details.productName]];
  const price = priceText(details);
  if (price)
    rows.push([
      details.kind === "subscription" ? "Price" : "Paid",
      details.billingPeriod ? `${price} per ${details.billingPeriod}` : price,
    ]);
  if (details.credits) rows.push(["AI credits added", details.credits.toLocaleString("en-US")]);
  if (details.creditsNote) rows.push(["AI credits", details.creditsNote]);
  if (details.accessEndsAt)
    rows.push([
      details.kind === "subscription"
        ? "Current period ends"
        : details.kind === "pass"
          ? "Access until"
          : "Credits usable until",
      formatDate(details.accessEndsAt),
    ]);
  return rows;
}

/** The renewal line, or the one-time line: the sentence the Terms require us to repeat. */
export function purchaseConfirmationTerms(details: PurchaseConfirmation): string {
  if (details.kind !== "subscription")
    return "This is a one-time purchase. It does not renew and you will not be charged again for it.";
  const price = priceText(details);
  const when = details.renewsAt
    ? ` on ${formatDate(details.renewsAt)}`
    : " at the end of each billing period";
  const amount = price && details.billingPeriod ? ` at ${price} per ${details.billingPeriod}` : "";
  return `Your subscription renews automatically${when}${amount} unless you cancel before then. You can cancel any time from Billing in VeriWorkly, and you keep access until the end of the period you have paid for.`;
}

export function renderPurchaseConfirmationEmail(
  name: string,
  details: PurchaseConfirmation,
): string {
  const sanitizedName = escapeHtml(name || "there");
  const product = escapeHtml(details.productName);
  const title = "Purchase confirmed";
  const preheader = `Your VeriWorkly purchase is confirmed: ${product}.`;
  const rows = purchaseConfirmationRows(details).map(
    ([label, value]) => [escapeHtml(label), escapeHtml(value)] as [string, string],
  );

  const bodyHtml = `
    <h2 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;font-weight:800;color:#171717;letter-spacing:-0.03em;text-align:center;">
      Thanks, ${sanitizedName}. Your purchase is confirmed.
    </h2>

    <p style="margin:0 auto 8px auto;font-size:15px;line-height:1.6;color:#5f5c54;text-align:center;max-width:440px;">
      ${product} is active on your account now.
    </p>
    ${summaryTable(rows)}

    <p style="margin:0 auto 20px auto;font-size:14px;line-height:1.6;color:#5f5c54;text-align:center;max-width:440px;">
      ${escapeHtml(purchaseConfirmationTerms(details))}
    </p>

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8c85;text-align:center;">
      Receipts and invoices are in Billing, under Manage billing. Questions? Reach us at info@veriworkly.com.
    </p>
  `;

  return getBaseLayout({ title, preheader, bodyHtml });
}
