import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A run of the parity suite produces more detail than a terminal keeps. Every
 * comparison is appended here so a failing run can be read in full afterwards.
 */
const REPORT_PATH = join(process.cwd(), "tests", "parity", ".report.log");

let started = false;

function ensureStarted() {
  if (started) return;

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `parity run ${new Date().toISOString()}\n\n`, "utf8");
  started = true;
}

export function recordReport(label: string, report: string, meta: Record<string, unknown> = {}) {
  ensureStarted();

  const detail = Object.entries(meta)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  const status = report === "" ? "OK" : "DIFF";
  const body = report === "" ? "" : `\n${report}\n`;

  appendFileSync(REPORT_PATH, `[${status}] ${label} ${detail}${body}\n`, "utf8");
}

export { REPORT_PATH };
