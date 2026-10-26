import { getBaseLayout, escapeHtml } from "../shared/layout.js";

import { formatDate, formatMoney, summaryTable } from "./billingFormat.js";

/** A subscription charge that failed (V-172): what failed, and what happens next. */
export type PaymentFailedNotice = {
  productName: string;
  amountCents: number | null;
  currency: string | null;
  /** When the account moves to the free plan if the payment is still outstanding. */
  graceEndsAt: Date;
};

export function paymentFailedParagraphs(details: PaymentFailedNotice): string[] {
  const amount =
    details.amountCents !== null && details.currency
      ? ` of ${formatMoney(details.amountCents, details.currency)}`
      : "";
  return [
    `We could not take the payment${amount} for your ${details.productName} subscription. Our payment provider will retry the card automatically.`,
    "To keep your plan, check or update your payment method from Billing in VeriWorkly (Manage billing). Paid features may be paused until the payment goes through.",
    `If the payment has not gone through by ${formatDate(details.graceEndsAt)}, your account moves to the free plan. Nothing you have created is deleted.`,
  ];
}

export function renderPaymentFailedEmail(name: string, details: PaymentFailedNotice): string {
  const sanitizedName = escapeHtml(name || "there");
  const product = escapeHtml(details.productName);
  const title = "Payment failed";
  const preheader = `We could not take the payment for your ${product} subscription.`;
  const paragraphs = paymentFailedParagraphs(details)
    .map(
      (text) =>
        `<p style="margin:0 auto 16px auto;font-size:15px;line-height:1.6;color:#5f5c54;text-align:center;max-width:440px;">${escapeHtml(text)}</p>`,
    )
    .join("\n    ");

  const bodyHtml = `
    <h2 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;font-weight:800;color:#171717;letter-spacing:-0.03em;text-align:center;">
      ${sanitizedName}, your payment did not go through
    </h2>
    ${summaryTable([
      ["Plan", product],
      ["Free plan from", escapeHtml(formatDate(details.graceEndsAt))],
    ])}
    ${paragraphs}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8c85;text-align:center;">
      Questions? Reach us at info@veriworkly.com.
    </p>
  `;

  return getBaseLayout({ title, preheader, bodyHtml });
}
