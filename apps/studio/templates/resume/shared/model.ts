import type { ResumeCustomSection, ResumeData, ResumeSection } from "@/types/resume";

import { formatDateRange } from "@/features/resume/services/resume-formatters";
import {
  cleanResumeText,
  getEducationMeta,
  getEducationSchool,
  getEducationTitle,
  getProjectLinkText,
  getProjectTitle,
  hasCustomItemContent,
  hasCustomSectionContent,
  hasResumeSectionContent,
  normalizeLinkHref,
} from "@/features/documents/rendering/resume-rendering";

/**
 * Shared, renderer-agnostic shape for every item a resume section can print.
 *
 * Both the web preview and the PDF export build their items from these helpers,
 * so a field can never appear in one renderer and silently vanish from the
 * other (the WYSIWYG class of bug this file exists to prevent).
 */
export interface ResumeRenderItem {
  id: string;
  /** Primary heading of the item (role, degree, project, certificate...). */
  title: string;
  /** Right-hand meta column, usually a date range. */
  meta: string;
  /** Secondary line under the title (company | location, school, tech stack). */
  subtitle: string;
  /** Optional trailing link rendered next to the title. */
  link: { href: string; text: string } | null;
  summary: string;
  bullets: string[];
}

export interface ResumeSkillLine {
  id: string;
  label: string;
  value: string;
}

/** Sections that participate in the flowing body, in user-defined order. */
export function getOrderedResumeSections(resume: ResumeData): ResumeSection[] {
  return [...resume.sections]
    .filter((section) => section.id !== "basics" && section.id !== "links")
    .filter((section) => section.visible !== false)
    .sort((a, b) => a.order - b.order);
}

function joinMeta(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => cleanResumeText(part))
    .filter(Boolean)
    .join(" | ");
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => cleanResumeText(value)).filter(Boolean);
}

/**
 * Titles are left empty when the user has not filled them in, never substituted with
 * a placeholder word.
 *
 * Entries reaching here are pre-filtered by `hasExperienceContent` and friends, which
 * pass an entry that has *any* content — so a row with a company and bullets but no
 * role would previously render the literal text "Role" into the preview and, worse,
 * into the exported PDF/DOCX/HTML. Renderers skip an empty title (see `renderItem` in
 * shared/web.tsx and shared/pdf.tsx).
 */
export function getExperienceRenderItems(items: ResumeData["experience"]): ResumeRenderItem[] {
  return items.map((item) => ({
    id: item.id,
    title: cleanResumeText(item.role),
    meta: formatDateRange(item.startDate, item.endDate, item.current),
    subtitle: joinMeta([item.company, item.location]),
    link: null,
    summary: cleanResumeText(item.summary),
    bullets: cleanList(item.highlights),
  }));
}

export function getEducationRenderItems(items: ResumeData["education"]): ResumeRenderItem[] {
  return items.map((item) => ({
    id: item.id,
    title: getEducationTitle(item),
    meta: getEducationMeta(item),
    subtitle: getEducationSchool(item),
    link: null,
    summary: cleanResumeText(item.summary),
    bullets: [],
  }));
}

export function getProjectRenderItems(items: ResumeData["projects"]): ResumeRenderItem[] {
  return items.map((item) => {
    const href = normalizeLinkHref(item.link);

    return {
      id: item.id,
      title: getProjectTitle(item),
      meta: "",
      subtitle: cleanList(item.skills).join(", "),
      link: href ? { href, text: getProjectLinkText(item) || href } : null,
      summary: cleanResumeText(item.summary),
      bullets: cleanList(item.highlights),
    };
  });
}

export function getCustomRenderItems(section: ResumeCustomSection): ResumeRenderItem[] {
  return section.items.filter(hasCustomItemContent).map((item) => {
    const href = normalizeLinkHref(item.link);

    return {
      id: item.id,
      title: cleanResumeText(item.name) || "Item",
      meta: cleanResumeText(item.date),
      subtitle: joinMeta([item.issuer, item.referenceId]),
      link: href ? { href, text: cleanResumeText(item.link) } : null,
      summary: cleanResumeText(item.description),
      bullets: cleanList(item.details),
    };
  });
}

export function getSkillLines(groups: ResumeData["skills"]): ResumeSkillLine[] {
  return groups.map((group, index) => ({
    id: group.id || `${group.name}-${index}`,
    label: cleanResumeText(group.name),
    value: cleanList(group.keywords).join(", "),
  }));
}

export interface ResumeSectionBlock<T> {
  id: string;
  title: string;
  children: T;
}

/**
 * How each renderer turns one section's content into its own node type.
 */
export interface ResumeSectionRenderers<T> {
  items: (items: ResumeRenderItem[]) => T;
  skills: (lines: ResumeSkillLine[]) => T;
  summary: (text: string) => T;
}

/**
 * The sections a resume actually prints, in order, with the empty ones dropped.
 *
 * Shared so the two renderers cannot disagree about which sections exist or
 * what order they come in — and so each of them can tell which section is
 * *first*, which decides where the spacing between sections goes. Spacing sits
 * above a section rather than below it, because a trailing margin on the last
 * one is invisible on screen yet still counts against the page in react-pdf.
 */
export function buildResumeSections<T>(
  resume: ResumeData,
  model: {
    visibleExperience: ResumeData["experience"];
    visibleEducation: ResumeData["education"];
    visibleProjects: ResumeData["projects"];
    visibleSkills: ResumeData["skills"];
  },
  render: ResumeSectionRenderers<T>,
): ResumeSectionBlock<T>[] {
  const blocks: ResumeSectionBlock<T>[] = [];

  for (const section of getOrderedResumeSections(resume)) {
    switch (section.id) {
      case "summary":
        if (!hasResumeSectionContent(resume, "summary")) break;
        blocks.push({
          id: section.id,
          title: "Summary",
          children: render.summary(cleanResumeText(resume.summary)),
        });
        break;

      case "experience":
        if (!hasResumeSectionContent(resume, "experience")) break;
        blocks.push({
          id: section.id,
          title: "Experience",
          children: render.items(getExperienceRenderItems(model.visibleExperience)),
        });
        break;

      case "education":
        if (!hasResumeSectionContent(resume, "education")) break;
        blocks.push({
          id: section.id,
          title: "Education",
          children: render.items(getEducationRenderItems(model.visibleEducation)),
        });
        break;

      case "projects":
        if (!hasResumeSectionContent(resume, "projects")) break;
        blocks.push({
          id: section.id,
          title: "Projects",
          children: render.items(getProjectRenderItems(model.visibleProjects)),
        });
        break;

      case "skills":
        if (!hasResumeSectionContent(resume, "skills")) break;
        blocks.push({
          id: section.id,
          title: "Skills",
          children: render.skills(getSkillLines(model.visibleSkills)),
        });
        break;

      default: {
        const custom = resume.customSections.find((entry) => entry.kind === section.id);

        if (!custom || !hasCustomSectionContent(custom)) break;

        blocks.push({
          id: section.id,
          title: cleanResumeText(custom.title),
          children: render.items(getCustomRenderItems(custom)),
        });
      }
    }
  }

  return blocks;
}
