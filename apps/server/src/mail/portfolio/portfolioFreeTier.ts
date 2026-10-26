import { getBaseLayout, escapeHtml, escapeUrlAttribute } from "../shared/layout.js";

/**
 * A premium portfolio whose paid plan ended was brought back online on a free template (owner
 * decision 6): what happened, what changed on the site, and how to get the premium design back.
 */
export type PortfolioFreeTierNotice = {
  /** The free template the site now uses, as the template picker names it ("Atelier"). */
  freeTemplateName: string;
  /** The premium template it used before ("Nimbus"). */
  previousTemplateName: string;
  portfolioUrl: string;
  /**
   * True when the site had been offline (billing suspended it) and is back; false when it stayed
   * online through the grace window and only its template changed.
   */
  wasOffline: boolean;
};

export function portfolioFreeTierParagraphs(details: PortfolioFreeTierNotice): string[] {
  return [
    `Your paid plan has ended, so your portfolio could no longer use the premium ${details.previousTemplateName} template.`,
    details.wasOffline
      ? `Rather than leave it offline, we put it back online on the free ${details.freeTemplateName} template. It shows the VeriWorkly badge, as free portfolios do. Your content is unchanged.`
      : `Your portfolio stays online, now on the free ${details.freeTemplateName} template. It shows the VeriWorkly badge, as free portfolios do. Your content is unchanged.`,
    `To bring back ${details.previousTemplateName} and remove the badge, upgrade from Billing in VeriWorkly and publish again.`,
  ];
}

export function renderPortfolioFreeTierEmail(
  name: string,
  details: PortfolioFreeTierNotice,
): string {
  const sanitizedName = escapeHtml(name || "there");
  const title = details.wasOffline
    ? "Your portfolio is back online"
    : "Your portfolio moved to a free template";
  const preheader = details.wasOffline
    ? `Your portfolio is online again on the free ${escapeHtml(details.freeTemplateName)} template.`
    : `Your portfolio is now on the free ${escapeHtml(details.freeTemplateName)} template.`;
  const paragraphs = portfolioFreeTierParagraphs(details)
    .map(
      (text) =>
        `<p style="margin:0 auto 16px auto;font-size:15px;line-height:1.6;color:#5f5c54;text-align:center;max-width:440px;">${escapeHtml(text)}</p>`,
    )
    .join("\n    ");

  const bodyHtml = `
    <h2 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;font-weight:800;color:#171717;letter-spacing:-0.03em;text-align:center;">
      ${sanitizedName}, your portfolio is on the free template
    </h2>
    ${paragraphs}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;text-align:center;">
      <tr>
        <td align="center">
          <a href="${escapeUrlAttribute(details.portfolioUrl)}" target="_blank" style="background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;display:inline-block;">
            View your portfolio
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8c85;text-align:center;">
      Questions? Reach us at info@veriworkly.com.
    </p>
  `;

  return getBaseLayout({ title, preheader, bodyHtml });
}
