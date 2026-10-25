import type {
  MasterProfileData,
  ResumeAward,
  ResumeSection,
  ResumeLanguage,
  ResumeInterest,
  ResumeReference,
  ResumeVolunteer,
  ResumeSkillGroup,
  ResumeAchievement,
  ResumeCertificate,
  ResumeProjectItem,
  ResumePublication,
  ResumeCustomSection,
  ResumeEducationItem,
  ResumeExperienceItem,
} from "@/types/resume";

import { createId } from "@veriworkly/profile-core";

import { fontOptions } from "@/features/documents/constants/fonts";

/*
 * What is left here is the master editor UI: the option lists the selects render and the
 * empty-item factories the "Add" buttons call.
 *
 * Everything that describes the *profile itself* — the save validator, the save sanitiser,
 * the id normalisers, the URL and email predicates — moved to `@veriworkly/profile-core`,
 * because the server needs exactly those rules and used to carry its own drifting copy of
 * them. They are re-exported below so this module stays the single import site the editor
 * components already use.
 */
export {
  createId,
  ensureUniqueIds,
  normalizeProfileIds,
  isValidAbsoluteUrl,
  normalizeAbsoluteUrl,
  sanitizeMasterProfileForSave,
  validateMasterProfileForSave,
  // Named `isValidEmail` here since the editor was written against that name; it is the
  // strict predicate (a blank string is not a valid address).
  isEmail as isValidEmail,
} from "@veriworkly/profile-core";

export const linkTypes = ["github", "linkedin", "portfolio"] as const;
export const fontFamilies = fontOptions.map((font) => font.value);

export const fluencyOptions: ResumeLanguage["fluency"][] = [
  "elementary",
  "limited",
  "professional",
  "fluent",
  "native",
];

export const sectionLabels: Record<ResumeSection["id"], string> = {
  basics: "Basics",
  links: "Links",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
  languages: "Languages",
  interests: "Interests",
  volunteer: "Volunteer",
  references: "References",
  achievements: "Achievements",
  custom: "Custom",
};

export function emptyExperience(): ResumeExperienceItem {
  return {
    id: createId("experience"),
    company: "",
    role: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    summary: "",
    highlights: [],
  };
}

export function emptyEducation(): ResumeEducationItem {
  return {
    id: createId("education"),
    school: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
    current: false,
    summary: "",
  };
}

export function emptyProject(): ResumeProjectItem {
  return {
    id: createId("project"),
    name: "",
    role: "",
    link: "",
    linkLabel: "Link",
    showLinkAsText: true,
    summary: "",
    highlights: [],
    skills: [],
  };
}

export function emptySkill(): ResumeSkillGroup {
  return {
    id: createId("skill"),
    name: "",
    keywords: [],
  };
}

export function emptyLanguage(): ResumeLanguage {
  return {
    id: createId("language"),
    language: "",
    fluency: "professional",
  };
}

export function emptyInterest(): ResumeInterest {
  return {
    id: createId("interest"),
    name: "",
    keywords: [],
  };
}

export function emptyAward(): ResumeAward {
  return {
    id: createId("award"),
    title: "",
    awarder: "",
    date: "",
    website: "",
    description: "",
    showLink: false,
  };
}

export function emptyCertificate(): ResumeCertificate {
  return {
    id: createId("certificate"),
    title: "",
    issuer: "",
    date: "",
    website: "",
    referenceId: "",
    description: "",
    showLink: false,
  };
}

export function emptyPublication(): ResumePublication {
  return {
    id: createId("publication"),
    title: "",
    publisher: "",
    date: "",
    website: "",
    description: "",
    showLink: false,
  };
}

export function emptyVolunteer(): ResumeVolunteer {
  return {
    id: createId("volunteer"),
    organization: "",
    role: "",
    startDate: "",
    endDate: "",
    current: false,
    location: "",
    summary: "",
  };
}

export function emptyReference(): ResumeReference {
  return {
    id: createId("reference"),
    name: "",
    title: "",
    organization: "",
    email: "",
    phone: "",
    relationship: "",
  };
}

export function emptyAchievement(): ResumeAchievement {
  return {
    id: createId("achievement"),
    title: "",
    description: "",
  };
}

export function emptyCustomSection(): ResumeCustomSection {
  return {
    id: createId("custom"),
    kind: "custom",
    title: "Other",
    items: [],
    editableTitle: true,
  };
}

export function updateItem<T extends { id: string }>(
  items: T[],
  id: string,
  updater: (item: T) => T,
) {
  return items.map((item) => (item.id === id ? updater(item) : item));
}

export function removeItem<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}

/**
 * The Master Profile's GitHub / LinkedIn / Portfolio fields edit the first link of that
 * type: typing updates it (or adds one), clearing the field removes it.
 */
export function setLinkByType(
  links: MasterProfileData["links"],
  type: MasterProfileData["links"]["items"][number]["type"],
  url: string,
): MasterProfileData["links"] {
  const index = links.items.findIndex((item) => item.type === type);

  if (!url.trim()) {
    return index === -1 ? links : { ...links, items: links.items.filter((_, i) => i !== index) };
  }

  if (index === -1) {
    return { ...links, items: [...links.items, { id: createId("link"), type, label: "", url }] };
  }

  return {
    ...links,
    items: links.items.map((item, i) => (i === index ? { ...item, url } : item)),
  };
}

/** Identifies a visibility row: every custom section shares the id "custom". */
export function sectionRowKey(section: Pick<ResumeSection, "id" | "customSectionId">) {
  return section.customSectionId ? `${section.id}:${section.customSectionId}` : section.id;
}

/**
 * One "custom" visibility row per custom section, matched on `customSectionId`, the way the
 * resume normalises its own sections. Rows for removed sections and duplicate rows are
 * dropped, a row without `customSectionId` (older profiles) is claimed by the first custom
 * section, and a section without a row gets a visible one at the end. Returns `profile`
 * itself when nothing needed fixing, so an already-consistent profile never looks edited.
 */
export function withCustomSectionRows(profile: MasterProfileData): MasterProfileData {
  const customIds = new Set(profile.customSections.map((section) => section.id));
  const firstCustomId = profile.customSections[0]?.id;
  const claimed = new Set<string>();
  let changed = false;

  const kept = profile.sections.flatMap((section) => {
    if (section.id !== "custom") return [section];

    const target = section.customSectionId
      ? customIds.has(section.customSectionId)
        ? section.customSectionId
        : undefined
      : firstCustomId;

    if (!target || claimed.has(target)) {
      changed = true;
      return [];
    }

    claimed.add(target);

    if (target === section.customSectionId) return [section];

    changed = true;
    return [{ ...section, customSectionId: target }];
  });

  let order = Math.max(0, ...profile.sections.map((section) => section.order));

  const added = profile.customSections
    .filter((section) => !claimed.has(section.id))
    .map((section) => ({
      id: "custom" as const,
      label: section.title || "Custom",
      visible: true,
      order: (order += 1),
      customSectionId: section.id,
    }));

  if (!changed && added.length === 0) return profile;

  return { ...profile, sections: [...kept, ...added] };
}
