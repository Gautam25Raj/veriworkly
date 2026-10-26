import { config } from "#config";
import {
  ambassadorDecisionParagraphs,
  ambassadorDecisionSubject,
  renderAmbassadorDecisionEmail,
  type AmbassadorDecision,
} from "#mail/ambassador/ambassadorDecision";

import { sendMail } from "./transporter.js";

/** The applicant's decision (V-181): the studio and the site both promise this email. */
export async function sendAmbassadorDecisionEmail(
  email: string,
  details: Omit<AmbassadorDecision, "ambassadorUrl">,
): Promise<void> {
  const ambassadorUrl = `${config.auth.studioUrl.replace(/\/+$/, "")}/ambassador`;
  const decision = { ...details, ambassadorUrl };
  const text = [
    details.firstName ? `Hi ${details.firstName},` : "Hi,",
    "",
    ...ambassadorDecisionParagraphs(decision).flatMap((paragraph) => [paragraph, ""]),
    `Your ambassador page: ${ambassadorUrl}`,
  ].join("\n");

  await sendMail({
    to: email,
    subject: ambassadorDecisionSubject(details.decision),
    text,
    html: renderAmbassadorDecisionEmail(decision),
  });
}
