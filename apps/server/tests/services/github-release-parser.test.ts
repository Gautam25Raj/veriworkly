import { describe, expect, it } from "vitest";
import { parseReleaseBody, reparseStoredRelease } from "../../src/services/github/index.js";

describe("GitHub Release Body Parser", () => {
  it("parses release notes with preamble summary, categorized headers, and multi-line bullets", () => {
    const rawMarkdown = `
This release introduces the profile-core workspace package and major UI updates.

### What's Changed
* **@veriworkly/profile-core (new package)**: Shared workspace package containing the canonical MasterProfile Zod schema, normalizer (\`normalizeMasterProfile\`), validator (\`validateMasterProfile\`), v1-to-v2 migration pipeline, and document projections (\`projectToResume\`, \`projectToCoverLetter\`, \`projectToPortfolio\`).
  Common helpers for phone formatting, sanitization, and primitive coercion are also included.
  Studio, Portfolio, and the server now all import from this single source.
* Three new cover letter templates: Minimalist, Executive, and ATS Essential

### Improvements
* Server profileImportService rewritten to use projectToResume from profile-core
* SectionVisibilitySettings panel rewritten with drag-to-reorder

### Bug Fixes
* Fixed corrupt master profile crash in editor

## New Contributors
* @newdev made their first contribution in https://github.com/VeriWorkly/veriworkly/pull/100

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/v3.23.0...v3.24.0
    `;

    const result = parseReleaseBody(rawMarkdown);

    expect(result.summary).toBe(
      "This release introduces the profile-core workspace package and major UI updates.",
    );
    expect(result.added.length).toBe(2);
    expect(result.added[0]).toContain("@veriworkly/profile-core (new package)");
    expect(result.added[0]).toContain("Common helpers for phone formatting");
    expect(result.added[0]).toContain("Studio, Portfolio, and the server now all import");
    expect(result.added[1]).toContain("Three new cover letter templates");

    expect(result.improved.length).toBe(2);
    expect(result.improved[0]).toContain("Server profileImportService rewritten");

    expect(result.fixed.length).toBe(1);
    expect(result.fixed[0]).toBe("Fixed corrupt master profile crash in editor");

    // Should skip contributors and full changelog
    expect(result.added.some((i) => i.includes("made their first contribution"))).toBe(false);
    expect(result.added.some((i) => i.includes("Full Changelog"))).toBe(false);
  });

  it("handles null or empty body", () => {
    const result = parseReleaseBody(null);
    expect(result).toEqual({
      summary: null,
      added: [],
      improved: [],
      fixed: [],
      breaking: [],
      security: [],
      pullRequests: [],
    });
  });

  it("keeps rules, the intro and the PR list out of the change lists", () => {
    // The shape of the real v3.22.0 and v3.29.0 release bodies.
    const rawMarkdown = `
## 🚀 v3.22.0

This release adds profile imports and multi-page portfolios.

---

## Highlights

* LinkedIn and GitHub profile imports

---

## New Features

* **Multi-page portfolios**: Portfolios can now have multiple pages.

---

## Full Changelog

* **#191** — [Feature] [Server/Studio]: add ambassador program
* **#190** — [Refactor] [Server/Studio]: modularize affiliate service

## 🔀 Pull Requests

- **#221** - \`[Chore] [Site]: move to @veriworkly/ats-engine 0.16.0\` by @Gautam25Raj

---
`;

    const result = parseReleaseBody(rawMarkdown);

    expect(result.summary).toBe("This release adds profile imports and multi-page portfolios.");
    expect(result.added).toEqual([
      "LinkedIn and GitHub profile imports",
      "**Multi-page portfolios**: Portfolios can now have multiple pages.",
    ]);
    expect(result.pullRequests).toEqual([
      { number: 191, title: "[Feature] [Server/Studio]: add ambassador program" },
      { number: 190, title: "[Refactor] [Server/Studio]: modularize affiliate service" },
      { number: 221, title: "[Chore] [Site]: move to @veriworkly/ats-engine 0.16.0" },
    ]);
  });

  it("repairs a stored release that was parsed before rules and PR lists were understood", () => {
    const body = `
## v1.0.0

Intro.

---

## Highlights

* Exports

## Full Changelog

* **#12** — [Fix] [Site]: tidy footer
`;
    const repoUrl = "https://github.com/acme/app";
    const author = { login: "dev", avatarUrl: "a.png", htmlUrl: "https://github.com/dev" };

    // What the old parser stored for this body.
    const stored = {
      summary: "---",
      added: ["Exports ---", "**#12** — [Fix] [Site]: tidy footer"],
      improved: [],
      fixed: [],
      breaking: [],
      security: [],
      prRefs: [{ number: 11, title: "Earlier PR", url: `${repoUrl}/pull/11`, author }],
    };

    const update = reparseStoredRelease(body, stored, repoUrl);

    expect(update?.summary).toBe("Intro.");
    expect(update?.added).toEqual(["Exports"]);
    expect(update?.prRefs).toEqual([
      stored.prRefs[0],
      { number: 12, title: "[Fix] [Site]: tidy footer", url: `${repoUrl}/pull/12`, author: null },
    ]);

    // Already clean: nothing to write.
    expect(reparseStoredRelease(body, update!, repoUrl)).toBeNull();
  });
});
