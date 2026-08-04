import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { siteConfig } from "@/config/site";

const TIERS = [
  {
    name: "No account",
    price: "Free",
    note: "1 scan every 48 hours",
    cta: { label: "Scan a resume", href: "/ats-checker/scan" },
    features: [
      "ATS readiness and job match scores",
      "Verdict: strong, needs work, or weak",
      "Per-area breakdown of where the score went",
      "Your single highest-impact fix",
    ],
    highlight: false,
  },
  {
    name: "Free account",
    price: "Free",
    note: "2 scans a day",
    cta: { label: "Create a free account", href: `${siteConfig.links.app}/login` },
    features: [
      "Everything without an account",
      "Every check's pass/fail evidence",
      "Full matched and missing keyword lists",
      "All fixes ranked by points recovered",
      "Copy the whole report as text",
    ],
    highlight: true,
  },
  {
    name: "AI plan",
    price: "$5.99/mo",
    note: "300 scans per period",
    cta: { label: "See AI plans", href: "/pricing" },
    features: [
      "Everything in Free account",
      "AI explanation of your score",
      "Missing-evidence detection",
      "Edits ranked by hiring impact",
      "Analyse a job posting from its URL",
    ],
    highlight: false,
  },
] as const;

export function TierComparison() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`relative flex flex-col rounded-3xl border p-6 ${
            tier.highlight
              ? "border-blue-500 bg-blue-500/3 dark:bg-blue-500/6"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-white/2"
          }`}
        >
          {tier.highlight ? (
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Most useful
            </span>
          ) : null}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{tier.name}</h3>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            {tier.price}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{tier.note}</p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {tier.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />{" "}
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href={tier.cta.href}
            className={`mt-6 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-black ${
              tier.highlight
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-zinc-950 text-white hover:bg-blue-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-500 dark:hover:text-white"
            }`}
          >
            {tier.cta.label}
          </Link>
        </div>
      ))}
    </div>
  );
}
