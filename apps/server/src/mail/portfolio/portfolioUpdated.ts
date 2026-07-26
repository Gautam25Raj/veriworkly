import { getBaseLayout, escapeHtml } from "../shared/layout.js";

export function renderPortfolioUpdatedEmail(portfolioUrl: string): string {
  const sanitizedUrl = escapeHtml(portfolioUrl);
  const title = "Your Portfolio is Live";
  const preheader = `Your VeriWorkly portfolio has been published at ${sanitizedUrl}.`;

  const bodyHtml = `
    <h2 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;font-weight:800;color:#171717;letter-spacing:-0.03em;text-align:center;">
      Your portfolio is live!
    </h2>

    <p style="margin:0 auto 28px auto;font-size:15px;line-height:1.6;color:#5f5c54;text-align:center;max-width:440px;">
      Your VeriWorkly portfolio has been published and is now visible to the world.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:36px 0;text-align:center;">
      <tr>
        <td align="center">
          <a href="${sanitizedUrl}" target="_blank" style="background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;display:inline-block;box-shadow:0 4px 12px rgba(37, 99, 235, 0.15);">
            View Your Portfolio →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8c85;text-align:center;">
      Share this link on your resume, LinkedIn, or anywhere you want to make an impression.
    </p>
  `;

  return getBaseLayout({ title, preheader, bodyHtml });
}
