import { renderSubscriptionPurchasedEmail, renderSubscriptionCancelledEmail } from "#mail/index";

import { sendMail } from "./transporter.js";

/**
 * Send subscription purchase confirmation email
 */
export async function sendSubscriptionPurchasedEmail(
  email: string,
  name: string,
  planName: string,
): Promise<void> {
  const subject = `Welcome to VeriWorkly Pro: ${planName} Activated!`;
  const text = `Hi ${name},\n\nThank you for subscribing! Your account has been upgraded to ${planName}.`;
  const html = renderSubscriptionPurchasedEmail(name, planName);

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
