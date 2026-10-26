import {
  paymentFailedParagraphs,
  purchaseConfirmationRows,
  purchaseConfirmationTerms,
  renderPaymentFailedEmail,
  renderPurchaseConfirmationEmail,
  renderSubscriptionCancelledEmail,
  type PaymentFailedNotice,
  type PurchaseConfirmation,
} from "#mail/index";

import { sendMail } from "./transporter.js";

export type { PaymentFailedNotice, PurchaseConfirmation };

/**
 * Confirms a purchase (V-177): a new or newly paid subscription, a pass or a credit pack. The
 * subject names the product as sold; nothing here calls AI Credits "Pro".
 */
export async function sendPurchaseConfirmationEmail(
  email: string,
  details: PurchaseConfirmation & { name: string },
): Promise<void> {
  const subject = `Your VeriWorkly purchase is confirmed: ${details.productName}`;
  const text = [
    `Hi ${details.name},`,
    "",
    `Thanks for your purchase. ${details.productName} is active on your account now.`,
    "",
    ...purchaseConfirmationRows(details).map(([label, value]) => `${label}: ${value}`),
    "",
    purchaseConfirmationTerms(details),
    "",
    "Receipts and invoices are in Billing, under Manage billing. Questions? Reach us at info@veriworkly.com.",
  ].join("\n");
  const html = renderPurchaseConfirmationEmail(details.name, details);

  await sendMail({ to: email, subject, text, html });
}

/** A subscription charge failed and dunning has started (V-172). */
export async function sendPaymentFailedEmail(
  email: string,
  details: PaymentFailedNotice & { name: string },
): Promise<void> {
  const subject = `Payment failed for your VeriWorkly ${details.productName} subscription`;
  const text = [
    `Hi ${details.name},`,
    "",
    ...paymentFailedParagraphs(details).flatMap((p) => [p, ""]),
  ]
    .concat("Questions? Reach us at info@veriworkly.com.")
    .join("\n");
  const html = renderPaymentFailedEmail(details.name, details);

  await sendMail({ to: email, subject, text, html });
}

/**
 * Send subscription cancellation email
 */
export async function sendSubscriptionCancelledEmail(email: string, name: string): Promise<void> {
  const subject = "Your VeriWorkly subscription has been cancelled";
  const text = `Hi ${name},\n\nWe're sorry to see you go. Your subscription has been cancelled.`;
  const html = renderSubscriptionCancelledEmail(name);

  await sendMail({ to: email, subject, text, html });
}
