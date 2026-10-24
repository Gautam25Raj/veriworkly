import type { EncryptionBoundary } from "../types";

/** Every spec here must be backed by the repository; where a provider makes a guarantee, attribute it to the provider. */
export const ENCRYPTION_BOUNDARIES: EncryptionBoundary[] = [
  {
    id: "drafting",
    action: "Drafting and exporting",
    route: ["browser"],
    title: "Local-first browser storage",
    description:
      "Documents are drafted and rendered in your browser, and your drafts live in that browser's storage. Nothing is sent to us during document generation. Note that browser storage is not encrypted by us: on a shared or compromised machine, treat it as readable.",
    specs: [
      "Drafts held in browser storage, not our database",
      "No transmission during editing or export",
      "Sign in only when you want sync or publishing",
    ],
  },
  {
    id: "sync",
    action: "Syncing your profile",
    route: ["browser", "api", "database"],
    title: "Encrypted transit and Better Auth",
    description:
      "When you register and log in, your Master Profile and documents sync over an encrypted connection, with passwordless OTP verification handled by Better Auth. Storage-layer encryption is provided by our hosting and database providers under their terms, not implemented by us.",
    specs: [
      "Better Auth passwordless OTP login",
      "Encrypted in transit (HTTPS)",
      "At-rest encryption per our infrastructure providers",
    ],
  },
  {
    id: "publishing",
    action: "Publishing a portfolio",
    route: ["browser", "api", "database", "web"],
    title: "Public portfolios and subdomains",
    description:
      "Portfolios published to a veriworkly.com subdomain are served over HTTPS. Visitor counts are aggregated without third-party tracking cookies. Unpublishing takes the page private immediately, clears our own cache, and asks the public site to regenerate — allow a short window for any intermediate caches outside our control to catch up.",
    specs: [
      "HTTPS on every published subdomain",
      "Zero-cookie visitor aggregation",
      "Unpublish clears our cache and triggers revalidation",
    ],
  },
  {
    id: "ai",
    action: "Running an AI action",
    route: ["browser", "api", "ai"],
    title: "Third-party AI processing",
    description:
      "AI tailoring and cover letter drafting send your text to a third-party model provider. We do not store the prompt or the response beyond the request, and we do not train models on your data — but the text does leave our infrastructure, which is why every AI action is something you trigger deliberately.",
    specs: [
      "No model training on your career data",
      "Prompt and response not retained after the request",
      "Side-by-side diff review before any change lands",
    ],
  },
];
