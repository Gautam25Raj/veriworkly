import type { SecurityCommitment } from "../types";

export const SECURITY_COMMITMENTS: SecurityCommitment[] = [
  {
    title: "No keystroke telemetry",
    desc: "We never monitor or transmit your document typing.",
  },
  {
    title: "Encrypted in transit",
    desc: "HTTPS on every connection. At-rest encryption is provided by our infrastructure providers.",
  },
  {
    title: "Replies in 24 to 48 hours",
    desc: "A named point of contact who acknowledges every security report.",
  },
  {
    title: "Auditable MIT core",
    desc: "The code that handles your data is open source on GitHub.",
  },
];
