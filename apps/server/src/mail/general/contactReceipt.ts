import { getBaseLayout, escapeHtml } from "../shared/layout.js";

/**
 * The only submitter-controlled text a receipt may carry (V-088/V-046): the first word of the
 * name, letters only (no dots or slashes, so a mail client cannot auto-link it), max 40 chars.
 */
export function contactReceiptFirstName(name: string): string {
  const first = (name.trim().split(/\s+/)[0] ?? "").replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, 40);
  return first || "there";
}

/**
 * Fixed receipt sent to the address typed into the anonymous contact form. It never carries the
 * subject or message, which would make the form a relay for attacker text from our domain.
 */
export function renderContactReceiptEmail(firstName: string) {
  const safeName = escapeHtml(firstName);

  const text = `Hi ${firstName},\n\nThanks for contacting VeriWorkly. We've received your message and our team will get back to you within 24 to 48 hours.\n\nIf you didn't contact us, you can ignore this email.\n\nThe VeriWorkly Team\nhttps://veriworkly.com`;

  const html = getBaseLayout({
    title: "We received your message – VeriWorkly",
    preheader: "Thanks for contacting VeriWorkly. We'll get back to you within 24 to 48 hours.",
    bodyHtml: `
    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;font-weight:800;color:#0f172a;letter-spacing:-0.03em;text-align:center;">
      Thanks, ${safeName}!
    </h1>
    <p style="margin:0 auto 16px auto;font-size:15px;line-height:1.6;color:#475569;text-align:center;max-width:440px;">
      We've received your message and our team will get back to you within 24 to 48 hours.
    </p>
    <p style="margin:0 auto;font-size:13px;line-height:1.6;color:#94a3b8;text-align:center;max-width:440px;">
      If you didn't contact us, you can ignore this email.
    </p>
  `,
  });

  return { subject: "We've received your message – VeriWorkly", text, html };
}
