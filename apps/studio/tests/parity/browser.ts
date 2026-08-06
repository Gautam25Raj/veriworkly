import { chromium } from "playwright";

import type { Browser } from "playwright";

/**
 * Playwright's bundled Chromium is an unsigned download, which Windows
 * Application Control blocks on some machines. Falling back to an installed
 * Chrome or Edge keeps the harness runnable there — and measures the engine the
 * user's own browser runs, which is the point.
 */
const CHANNELS = ["chrome", "msedge", undefined] as const;

export async function launchParityBrowser(): Promise<Browser> {
  const failures: string[] = [];

  for (const channel of CHANNELS) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (error) {
      failures.push(`${channel ?? "bundled chromium"}: ${(error as Error).message.split("\n")[0]}`);
    }
  }

  throw new Error(
    `No Chromium-based browser could be launched.\n${failures.join("\n")}\n` +
      `Run \`npx playwright install chromium\`, or install Google Chrome.`,
  );
}
