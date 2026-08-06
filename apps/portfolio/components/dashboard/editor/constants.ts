import type { PortfolioSectionType } from "@/lib/portfolio";
import { sectionLabels } from "@/lib/section-fields";

export const inputClass =
  "w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm outline-none transition hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent-soft text-ink";

export const actionClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold whitespace-nowrap transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45";

export const sectionDetails: Record<PortfolioSectionType, string> = {
  projects: "Case studies and shipped work",
  experience: "Roles, teams, and outcomes",
  services: "Ways people can work with you",
  skills: "Capabilities and tools",
  education: "Degrees and training",
  writing: "Articles and talks",
  testimonials: "Words from collaborators",
  awards: "Recognition and milestones",
  certifications: "Licenses, credentials, and courses",
  languages: "Spoken and written proficiencies",
  interests: "Personal pursuits and hobbies",
  publications: "Articles, papers, and books",
  patents: "Inventions and intellectual property",
  testScores: "Standardized tests and exams",
  achievements: "Key milestones and recognitions",
  volunteer: "Non-profit and community service",
  custom: "Additional projects or lab sections",
  contact: "Your closing invitation",
};

/**
 * Label + one-line detail per section type, for the editor's panel header.
 *
 * The label comes from `sectionLabels` in `lib/section-fields.ts` so the editor
 * and the store (which titles newly added sections) can never disagree.
 */
export const sectionInfo: Record<PortfolioSectionType, { label: string; detail: string }> =
  Object.fromEntries(
    (Object.keys(sectionDetails) as PortfolioSectionType[]).map((type) => [
      type,
      { label: sectionLabels[type], detail: sectionDetails[type] },
    ]),
  ) as Record<PortfolioSectionType, { label: string; detail: string }>;
