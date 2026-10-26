import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  mainNav,
  supportNav,
  bottomNav,
  NavGroup,
  StudioNavLink,
} from "@/components/dashboard/sidebar/StudioNavigation";
import {
  readGuestBackupDismissed,
  rememberGuestBackupDismissed,
  shouldShowGuestBackupBanner,
} from "@/components/dashboard/guest-backup/guest-backup-banner-state";
import { templateGallery } from "@/app/(main)/(dashboard)/templates/template-gallery";
import { coverLetterTemplateRegistry } from "@/templates/cover-letter/registry";
import { resumeTemplateRegistry } from "@/templates/resume/registry";

const studioDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
}));

describe("dashboard navigation contracts", () => {
  it("exports navigation components and configs", () => {
    expect(NavGroup).toBeDefined();
    expect(StudioNavLink).toBeDefined();
    expect(mainNav).toBeDefined();
    expect(supportNav).toBeDefined();
    expect(bottomNav).toBeDefined();
  });

  it("defines expected main navigation items", () => {
    const labels = mainNav.map((item) => item.label);
    expect(labels).toContain("Overview");
    expect(labels).toContain("Documents");
    expect(labels).toContain("ATS checker");
    expect(labels).toContain("Templates");
    expect(labels).toContain("Portfolio");
  });

  it("correctly matches pathname routes for internal navigation", () => {
    const overview = mainNav.find((item) => item.label === "Overview")!;
    expect(overview.match("/")).toBe(true);
    expect(overview.match("/documents")).toBe(false);

    const documents = mainNav.find((item) => item.label === "Documents")!;
    expect(documents.match("/documents")).toBe(true);
    expect(documents.match("/documents/resume-1")).toBe(true);
    expect(documents.match("/ats")).toBe(false);

    const ats = mainNav.find((item) => item.label === "ATS checker")!;
    expect(ats.match("/ats")).toBe(true);
    expect(ats.match("/ats/check")).toBe(true);
  });

  it("defines expected resource and utility items", () => {
    const resourceLabels = supportNav.map((item) => item.label);
    expect(resourceLabels).toContain("Docs");
    expect(resourceLabels).toContain("Blog");

    const utilityLabels = bottomNav.map((item) => item.label);
    expect(utilityLabels).toContain("FAQ");
    expect(utilityLabels).toContain("API keys");
  });
});

describe("templates explorer stays inside the studio (#131)", () => {
  it("links Templates to the in-app gallery and marks it active there", () => {
    const templates = mainNav.find((item) => item.label === "Templates")!;

    expect(templates.href).toBe("/templates");
    expect(templates.external).toBeFalsy();
    expect(templates.match("/templates")).toBe(true);
    expect(templates.match("/documents")).toBe(false);
  });

  it("lists every registered template per type, each opening the editor with that template", () => {
    expect(templateGallery.RESUME.map((item) => item.id)).toEqual(resumeTemplateRegistry.ids);
    expect(templateGallery.COVER_LETTER.map((item) => item.id)).toEqual(
      coverLetterTemplateRegistry.ids,
    );
    expect(templateGallery.RESUME).toHaveLength(7);
    expect(templateGallery.COVER_LETTER).toHaveLength(5);

    expect(templateGallery.RESUME[0].href).toBe("/editor?type=resume&template=executive-clarity");
    expect(templateGallery.COVER_LETTER[0].href).toBe(
      `/editor?type=cover-letter&template=${coverLetterTemplateRegistry.ids[0]}`,
    );

    for (const item of [...templateGallery.RESUME, ...templateGallery.COVER_LETTER]) {
      expect(existsSync(join(studioDir, "public", item.previewImage))).toBe(true);
    }
  });
});

describe("every dashboard page has a loading skeleton shaped like itself (#127)", () => {
  const dashboardDir = join(studioDir, "app", "(main)", "(dashboard)");

  function pageDirectories(directory: string): string[] {
    const entries = readdirSync(directory, { withFileTypes: true });
    const own = entries.some((entry) => entry.name === "page.tsx") ? [directory] : [];

    return [
      ...own,
      ...entries
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => pageDirectories(join(directory, entry.name))),
    ];
  }

  it("finds the dashboard pages", () => {
    expect(pageDirectories(dashboardDir).length).toBeGreaterThan(15);
  });

  it.each(pageDirectories(dashboardDir).map((dir) => [relative(dashboardDir, dir) || "/", dir]))(
    "%s has its own loading.tsx",
    (_, dir) => {
      expect(existsSync(join(dir, "loading.tsx"))).toBe(true);
    },
  );

  it("the global loader uses no undefined keyframes", () => {
    const source = readFileSync(join(studioDir, "app", "loading.tsx"), "utf8");

    expect(source).not.toMatch(/animate-\[loading/);
  });
});

describe("guest backup reminder (S-214)", () => {
  const base = { authResolved: true, isLoggedIn: false, documentCount: 1, dismissed: false };

  it("S-214 shows for a guest once a document is saved in this browser", () => {
    expect(shouldShowGuestBackupBanner(base)).toBe(true);
  });

  it("S-214 stays hidden before a first document, for signed-in users, while auth loads, and once dismissed", () => {
    expect(shouldShowGuestBackupBanner({ ...base, documentCount: 0 })).toBe(false);
    expect(shouldShowGuestBackupBanner({ ...base, isLoggedIn: true })).toBe(false);
    expect(shouldShowGuestBackupBanner({ ...base, authResolved: false })).toBe(false);
    expect(shouldShowGuestBackupBanner({ ...base, dismissed: true })).toBe(false);
  });

  it("S-214 remembers a dismissal, and a refusing storage reads as not dismissed", () => {
    const values = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    });

    expect(readGuestBackupDismissed(storage)).toBe(false);
    rememberGuestBackupDismissed(storage);
    expect(readGuestBackupDismissed(storage)).toBe(true);

    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };

    expect(readGuestBackupDismissed(blocked)).toBe(false);
    expect(() => rememberGuestBackupDismissed(blocked)).not.toThrow();
  });
});
