import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Browser, BrowserContext, Page } from "playwright";

import type { ParityServer } from "../parity/server";

import { launchParityBrowser } from "../parity/browser";
import { startParityServer } from "../parity/server";

/**
 * What a new guest meets outside the editor: the in-app template gallery, a create button
 * wherever the studio says "no documents yet" (phones have no sidebar), and the reminder that
 * a guest's work lives only in this browser.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

let server: ParityServer;
let browser: Browser;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  server = await startParityServer();
  browser = await launchParityBrowser();

  context = await browser.newContext({ viewport: DESKTOP, acceptDownloads: true });
  await context.addCookies([{ name: "veriworkly-guest-mode", value: "true", url: server.origin }]);

  page = await context.newPage();
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

async function clearStorage() {
  await page.goto(`${server.origin}/documents`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

function storedResume(id: string) {
  return page.evaluate(
    (docId) => JSON.parse(localStorage.getItem(`veriworkly:docs:v3:doc:resume:${docId}`) ?? "null"),
    id,
  ) as Promise<{ templateId: string } | null>;
}

describe("in-app template gallery (#131)", () => {
  beforeAll(async () => {
    await page.setViewportSize(DESKTOP);
    await clearStorage();
  });

  it("lists the 7 resume and 5 cover letter templates", async () => {
    await page.goto(`${server.origin}/templates`, { waitUntil: "networkidle" });

    const visiblePanel = page.locator('[role="tabpanel"]:not([hidden])');

    expect(await visiblePanel.locator("article").count()).toBe(7);

    await page.getByRole("tab", { name: /Cover letters/ }).click();

    expect(await visiblePanel.locator("article").count()).toBe(5);
    expect(
      await page.getByRole("tab", { name: /Cover letters/ }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("the sidebar's Templates link stays in the studio", async () => {
    await page.goto(`${server.origin}/`, { waitUntil: "networkidle" });

    const link = page.getByRole("link", { name: "Templates" }).first();

    expect(await link.getAttribute("href")).toBe("/templates");
    expect(await link.getAttribute("target")).toBeNull();
  });

  it('"Use this template" opens the editor on a new document wearing that template', async () => {
    await page.goto(`${server.origin}/templates`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Use the Precision ATS template" }).click();

    await page.waitForURL(/\/editor\/resume\/(?!new)[^/?]+$/);
    await page.waitForTimeout(1_000);

    const id = page.url().split("/").pop()!;

    expect((await storedResume(id))?.templateId).toBe("precision-ats");
  });
});

describe("first-run create buttons on a phone (S-212)", () => {
  beforeAll(async () => {
    await page.setViewportSize(PHONE);
    await clearStorage();
  });

  it("the overview offers one first action, and it creates a resume", async () => {
    await page.goto(`${server.origin}/`, { waitUntil: "networkidle" });

    const create = page.getByRole("button", { name: "Create your first resume" });

    await create.waitFor();
    expect(await create.isVisible()).toBe(true);
    expect(await page.getByText("Use New Document in sidebar").count()).toBe(0);

    await create.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Resume/ }).click();

    await page.waitForURL(/\/editor\/resume\/(?!new)[^/?]+$/);
  });

  it("the documents empty state has a working create button at 375px", async () => {
    await clearStorage();
    await page.goto(`${server.origin}/documents`, { waitUntil: "networkidle" });

    const emptyState = page.locator("div", { has: page.getByText("No documents yet") }).last();
    const create = emptyState.getByRole("button", { name: "New document" });

    await create.waitFor();

    const box = await create.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);

    await create.click();
    await page.getByRole("dialog").getByRole("heading", { name: "New document" }).waitFor();
  });

  it("the mobile header's create button is labelled", async () => {
    const button = page.locator("header.sticky").getByRole("button", { name: "New document" });

    expect(await button.count()).toBe(1);
  });
});

describe("guest backup reminder (S-214)", () => {
  beforeAll(async () => {
    await page.setViewportSize(DESKTOP);
    await clearStorage();
  });

  it("is absent before the guest has a document", async () => {
    await page.goto(`${server.origin}/documents`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    expect(await page.getByRole("region", { name: "Backup reminder" }).count()).toBe(0);
  });

  it("appears on the dashboard once a document exists, not over the editor, and downloads one backup", async () => {
    await page.goto(`${server.origin}/editor/resume/new`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !location.pathname.endsWith("/new"));

    const field = page.locator("input[type='text'], input:not([type]), textarea").first();
    await field.fill("Guest Writer");
    await page.waitForTimeout(800);

    // The editor fills the screen and scrolls inside itself, so the banner stays off it.
    expect(await page.getByRole("region", { name: "Backup reminder" }).count()).toBe(0);

    await page.goto(`${server.origin}/documents`, { waitUntil: "networkidle" });
    const banner = page.getByRole("region", { name: "Backup reminder" });
    await banner.waitFor();
    expect(await banner.textContent()).toContain("Your documents are saved only in this browser.");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      banner.getByRole("button", { name: "Download backup" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^veriworkly-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(backup.documents).toHaveLength(1);
    expect(backup.documents[0].type).toBe("RESUME");
  });

  it("stays dismissed for the rest of the session", async () => {
    await page.getByRole("button", { name: "Dismiss backup reminder" }).click();
    expect(await page.getByRole("region", { name: "Backup reminder" }).count()).toBe(0);

    await page.goto(`${server.origin}/documents`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    expect(await page.getByRole("region", { name: "Backup reminder" }).count()).toBe(0);
  });
});
