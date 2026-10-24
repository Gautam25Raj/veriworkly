import { fitDescription, fitTitle } from "@/utils/metadata";

/** "VeriWorkly vs X" already carries the brand, so the suffix is the page's subject, not the brand again. */
export const compareTitle = (competitorName: string) =>
  fitTitle(`VeriWorkly vs ${competitorName}`, "Pricing, ATS & Features");

export const compareDescription = (competitorName: string) =>
  fitDescription(
    `Honest side-by-side comparison of VeriWorkly vs ${competitorName}: ATS keyword scoring, download limits, pricing models and account requirements.`,
  );
