import { renderPortfolioUpdatedEmail } from "#mail/index";

import { sendMail } from "./transporter.js";

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
