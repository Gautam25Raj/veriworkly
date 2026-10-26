import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import nextConfig from "@/next.config";
import packageJson from "@/package.json";
import manifest from "@/app/manifest.json";
import { pluralize } from "@/lib/pluralize";
import SectionAccordion from "@/features/documents/editor/SectionAccordion";
import ToolbarHeader from "@/features/documents/editor/toolbar/ToolbarHeader";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
}));

const studioRoot = path.resolve(__dirname, "../..");

describe("pluralize", () => {
  it("uses the singular for exactly one and the plural otherwise", () => {
    expect(pluralize(1, "section")).toBe("1 section");
    expect(pluralize(2, "section")).toBe("2 sections");
    expect(pluralize(0, "view")).toBe("0 views");
    expect(pluralize(1, "view")).toBe("1 view");
  });

  it("takes an explicit plural for irregular nouns", () => {
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
  });
});

describe("web app manifest", () => {
  it("declares an identity, start URL, scope and description", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.description.length).toBeGreaterThan(0);
  });

  it("offers a non-maskable icon as well as maskable ones", () => {
    const purposes = manifest.icons.map((icon) => icon.purpose);

    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });

  it("points every icon at a file that ships", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(studioRoot, "public", icon.src))).toBe(true);
    }
  });
});

describe("build-time configuration", () => {
  it("reads the studio version from package.json", () => {
    expect(nextConfig.env?.STUDIO_VERSION).toBe(packageJson.version);
  });

  it("never hides text while a web font loads", () => {
    const css = readFileSync(path.join(studioRoot, "app/globals.css"), "utf8");

    expect(css).not.toMatch(/font-display:\s*block/);
  });
});

describe("editor accessibility", () => {
  it("S-166: a closed section does not reference a panel that is not rendered", () => {
    const closed = renderToStaticMarkup(
      <SectionAccordion id="skills" isOpen={false} label="Skills" onToggle={() => {}}>
        <p>panel</p>
      </SectionAccordion>,
    );

    expect(closed).not.toContain("aria-controls");
    expect(closed).toContain('aria-expanded="false"');
  });

  it("S-166: an open section points aria-controls at its rendered panel", () => {
    const open = renderToStaticMarkup(
      <SectionAccordion id="skills" isOpen label="Skills" onToggle={() => {}}>
        <p>panel</p>
      </SectionAccordion>,
    );

    expect(open).toContain('aria-controls="section-accordion-panel-skills"');
    expect(open).toContain('id="section-accordion-panel-skills"');
  });

  it("S-167: a save failure is announced politely; routine saves are not", () => {
    const failed = renderToStaticMarkup(
      <ToolbarHeader message="Storage is full." onBack={() => {}} />,
    );
    const saved = renderToStaticMarkup(
      <ToolbarHeader message="Saved on this device" onBack={() => {}} />,
    );

    expect(failed).toMatch(
      /<p[^>]*role="status"[^>]*aria-live="polite"[^>]*>Storage is full\.<\/p>/,
    );
    expect(saved).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/p>/);
    expect(saved).toContain("Saved on this device");
  });
});
