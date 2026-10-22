import { siteConfig } from "@/config/site";

export const ATS_TIERS = [
  {
    name: "Free account",
    price: "Free",
    period: "forever",
    note: "2 scans every 24 hours",
    badge: "Recommended",
    cta: { label: "Create a free account", href: `${siteConfig.links.app}/login` },
    features: [
      "ATS readiness and job match scores, with a verdict",
      "“What the ATS sees”: your recovered work history and dates",
      "Where points were lost, with pass/fail evidence per rule",
      "Matched and missing keyword lists",
      "Every fix, ranked by points recovered",
      "The whole report, copied as structured text",
    ],
    highlight: true,
  },
  {
    name: "AI plan",
    price: "$5.99",
    period: "/ month",
    note: "300 scans per billing cycle",
    badge: "Power User",
    cta: { label: "See AI plans", href: "/pricing" },
    features: [
      "Everything in the free account",
      "An AI explanation of how your resume scored",
      "Missing-evidence detection",
      "Suggested edits, ranked by likely screening impact",
      "Job postings read straight from a URL",
      "300 scans instead of 2 a day",
    ],
    highlight: false,
  },
] as const;
