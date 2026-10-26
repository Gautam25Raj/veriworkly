import {
  portfolioFreeTierParagraphs,
  renderPortfolioFreeTierEmail,
  renderPortfolioUpdatedEmail,
  type PortfolioFreeTierNotice,
} from "#mail/index";

import { sendMail } from "./transporter.js";

export type { PortfolioFreeTierNotice };

/** A lapsed premium portfolio is back online on a free template (owner decision 6). */
export async function sendPortfolioFreeTierEmail(
  email: string,
  details: PortfolioFreeTierNotice & { name: string },
): Promise<void> {
  const subject = details.wasOffline
    ? `Your VeriWorkly portfolio is back online on the free ${details.freeTemplateName} template`
    : `Your VeriWorkly portfolio is now on the free ${details.freeTemplateName} template`;
  const text = [
    `Hi ${details.name},`,
    "",
    ...portfolioFreeTierParagraphs(details).flatMap((paragraph) => [paragraph, ""]),
    `Your portfolio: ${details.portfolioUrl}`,
    "",
    "Questions? Reach us at info@veriworkly.com.",
  ].join("\n");
  const html = renderPortfolioFreeTierEmail(details.name, details);

  await sendMail({ to: email, subject, text, html });
}

/**
 * Send portfolio publication/update email
 */
export async function sendPortfolioUpdatedEmail(
  email: string,
  portfolioUrl: string,
): Promise<void> {
  const subject = "Your VeriWorkly Portfolio is Live!";
  const text = `Your portfolio has been updated successfully and is live at ${portfolioUrl}`;
  const html = renderPortfolioUpdatedEmail(portfolioUrl);

  await sendMail({ to: email, subject, text, html });
}
