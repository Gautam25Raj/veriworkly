import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ResumeData } from "@/types/resume";

import { defaultResume } from "@/features/resume/constants/default-resume";
import {
  getResumeRenderModel,
  normalizeLinkHref,
} from "@/features/documents/rendering/resume-rendering";
import {
  getEducationRenderItems,
  getExperienceRenderItems,
  getProjectRenderItems,
} from "@/templates/resume/shared/model";
import { loadTemplateComponentById, templateRegistry } from "@/templates";

/**
 * An entry the user has partially filled: real company and bullets, but no role, and no
 * dates. Every field that a template might substitute a placeholder for is blank.
 */
function partiallyFilledResume(): ResumeData {
  const resume = structuredClone(defaultResume) as ResumeData;

  resume.experience = [
    {
      id: "exp-partial",
      company: "Northwind Trading",
      role: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      summary: "",
      highlights: ["Rebuilt the settlement pipeline."],
    },
  ];

  resume.education = [
    {
      id: "edu-partial",
      school: "Riverside College",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
      current: false,
      summary: "",
    },
  ];

  resume.projects = [
    {
      id: "proj-partial",
      name: "",
      role: "",
      link: "",
      linkLabel: "Link",
      showLinkAsText: true,
      summary: "An internal tool.",
      highlights: [],
      skills: [],
    },
  ];

  return resume;
}

/**
 * Editor-only placeholder words that must never reach rendered output.
 *
 * Excludes words that double as legitimate section headings ("Education", "Projects"),
 * which cannot be distinguished from a leaked placeholder by text alone — those are
 * covered by the render-model assertion instead.
 */
const PLACEHOLDER_WORDS = ["Role", "Company", "Degree", "School", "Start", "End"];

describe("export hygiene contract", () => {
  it("leaves titles empty for blank fields instead of substituting the field label", () => {
    const resume = partiallyFilledResume();
    const model = getResumeRenderModel(resume);

    // Each entry has content (so it survives filtering) but no title field.
    expect(model.visibleExperience).toHaveLength(1);
    expect(model.visibleEducation).toHaveLength(1);
    expect(model.visibleProjects).toHaveLength(1);

    expect(getExperienceRenderItems(model.visibleExperience)[0].title).toBe("");
    expect(getEducationRenderItems(model.visibleEducation)[0].title).toBe("");
    expect(getProjectRenderItems(model.visibleProjects)[0].title).toBe("");

    // A blank date range must not print "Start - End".
    expect(getExperienceRenderItems(model.visibleExperience)[0].meta).toBe("");
  });

  it("does not render placeholder words for a partially filled resume in any template", async () => {
    const resume = partiallyFilledResume();

    for (const template of templateRegistry) {
      const TemplateComponent = await loadTemplateComponentById(template.id);
      const html = renderToStaticMarkup(
        <TemplateComponent resume={{ ...resume, templateId: template.id }} />,
      );

      // Strip attributes so class names and ids cannot produce false positives.
      const text = html.replace(/<[^>]*>/g, " ");

      for (const word of PLACEHOLDER_WORDS) {
        expect(
          new RegExp(`(^|\\s)${word}(\\s|$)`).test(text),
          `${template.id} must not print the placeholder "${word}"`,
        ).toBe(false);
      }

      // The real content the user did enter must still be there.
      expect(html).toContain("Northwind Trading");
      expect(html).toContain("Riverside College");
    }
  });

  it("neutralizes non-http link schemes rather than emitting them as hrefs", () => {
    const dangerous = [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ];

    for (const url of dangerous) {
      const href = normalizeLinkHref(url);

      // Anything outside the allowlist is prefixed, which renders it inert as a URL.
      expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
      expect(href.toLowerCase().startsWith("data:")).toBe(false);
      expect(href.toLowerCase().startsWith("vbscript:")).toBe(false);
      expect(href.toLowerCase().startsWith("file:")).toBe(false);
      expect(href.startsWith("https://")).toBe(true);
    }
  });

  it("keeps the schemes a resume legitimately needs", () => {
    expect(normalizeLinkHref("https://example.com")).toBe("https://example.com");
    expect(normalizeLinkHref("http://example.com")).toBe("http://example.com");
    expect(normalizeLinkHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(normalizeLinkHref("tel:+15550100")).toBe("tel:+15550100");
    expect(normalizeLinkHref("example.com")).toBe("https://example.com");
    expect(normalizeLinkHref("")).toBe("");
  });

  it("neutralizes schemes split by whitespace or control characters", () => {
    // Browsers historically tolerated whitespace inside a scheme; cleanResumeText
    // collapses it, which must not accidentally reassemble a live scheme.
    for (const url of [
      "java\nscript:alert(1)",
      "java\tscript:alert(1)",
      "  javascript:alert(1)  ",
    ]) {
      expect(normalizeLinkHref(url).toLowerCase()).not.toMatch(/^javascript:/);
    }
  });
});
