import { escapeHtml, escapeUrlAttribute, getBaseLayout } from "../shared/layout.js";

export type AmbassadorDecision = {
  decision: "APPROVED" | "REJECTED";
  /** The applicant's first name, or an empty string to greet without one. */
  firstName: string;
  /** The reviewer's note, already shown to the applicant on their ambassador page. */
  reviewNote: string | null;
  /** Where the applicant reads their status: the studio's ambassador page. */
  ambassadorUrl: string;
};

export function ambassadorDecisionSubject(decision: AmbassadorDecision["decision"]) {
  return decision === "APPROVED"
    ? "Your VeriWorkly ambassador application was approved"
    : "About your VeriWorkly ambassador application";
}

/** Plain paragraphs shared by the text and HTML bodies, so the two never say different things. */
export function ambassadorDecisionParagraphs({ decision, reviewNote }: AmbassadorDecision) {
  const paragraphs =
    decision === "APPROVED"
      ? [
          "Your application to the VeriWorkly campus ambassador program was approved. You are an ambassador from today.",
          "Your ambassador page in VeriWorkly has what you need to get started.",
        ]
      : [
          "Thank you for applying to the VeriWorkly campus ambassador program. We are not able to approve your application this time.",
          "You can update your answers and apply again from your ambassador page whenever you like.",
        ];

  return reviewNote ? [...paragraphs, `Note from the reviewer: ${reviewNote}`] : paragraphs;
}

export function renderAmbassadorDecisionEmail(details: AmbassadorDecision): string {
  const approved = details.decision === "APPROVED";
  const title = approved ? "You're a VeriWorkly ambassador" : "Your ambassador application";
  const greeting = details.firstName ? `Hi ${escapeHtml(details.firstName)},` : "Hi,";
  const paragraphs = ambassadorDecisionParagraphs(details)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#5f5c54;">${escapeHtml(paragraph)}</p>`,
    )
    .join("\n    ");

  const bodyHtml = `
    <h2 style="margin:0 0 20px 0;font-size:24px;line-height:1.25;font-weight:800;color:#171717;letter-spacing:-0.02em;">
      ${escapeHtml(title)}
    </h2>

    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#171717;">${greeting}</p>

    ${paragraphs}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
      <tr>
        <td align="left">
          <a href="${escapeUrlAttribute(details.ambassadorUrl)}" target="_blank" style="background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block;">
            Open your ambassador page
          </a>
        </td>
      </tr>
    </table>
  `;

  return getBaseLayout({ title: escapeHtml(title), preheader: escapeHtml(title), bodyHtml });
}
