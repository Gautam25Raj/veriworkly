import type { ResumeData } from "@/types/resume";
import type { ConvertedResume } from "@/features/ats/types";

import { blankResume } from "@/features/resume/constants/default-resume";
import { normalizeResumeData } from "@/features/resume/utils/normalize-data";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const ONGOING = /^(present|current|now|ongoing|today)$/i;

/** `linkedin.com/in/x` is how people write a link; the resume stores it with its scheme. */
export function toHttpUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * The model writes dates the way the old resume did: "Jan 2020", "March 2021", "03/2020",
 * "2020-3". Anything with a year and a month becomes YYYY-MM; a bare year has no month to
 * keep, and inventing January would put a false date on the resume, so it is left empty.
 */
export function toMonthDate(value: string): string {
  const trimmed = value.trim();

  const iso = /^(\d{4})[-/.](\d{1,2})$/.exec(trimmed);
  if (iso) return formatMonth(iso[1], Number(iso[2]));

  const numeric = /^(\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (numeric) return formatMonth(numeric[2], Number(numeric[1]));

  const named = /^([a-z]+)\.?,?\s+(\d{4})$/i.exec(trimmed);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase() as (typeof MONTHS)[number]);
    return month === -1 ? "" : formatMonth(named[2], month + 1);
  }

  return "";
}

function formatMonth(year: string, month: number): string {
  return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : "";
}

/** Education stores years only. */
function toYear(value: string): string {
  return /\b(\d{4})\b/.exec(value)?.[1] ?? "";
}

function isOngoing(item: { current: boolean; endDate: string }) {
  return item.current || ONGOING.test(item.endDate.trim());
}

/**
 * The AI conversion as a resume the strict export path accepts.
 *
 * Credits are spent before the draft reaches the studio, so nothing in it may make the save
 * fail: links get their scheme, dates are read rather than discarded, and phones stay as
 * the model wrote them (a local number without a country code is still the user's number).
 * Missing fields are normalised over the empty resume, never over sample content.
 */
export function buildResumeFromConversion(converted: ConvertedResume, id: string): ResumeData {
  return normalizeResumeData({
    id,
    basics: { ...blankResume.basics, ...converted.basics },
    summary: converted.summary,
    links: {
      displayMode: "icon-username",
      items: converted.links.map((item, index) => ({
        id: `link-${index + 1}`,
        type: "custom" as const,
        label: item.label,
        url: toHttpUrl(item.url),
      })),
    },
    experience: converted.experience.map((item, index) => {
      const current = isOngoing(item);

      return {
        ...item,
        id: `exp-${index + 1}`,
        startDate: toMonthDate(item.startDate),
        endDate: current ? "" : toMonthDate(item.endDate),
        current,
      };
    }),
    education: converted.education.map((item, index) => {
      const current = isOngoing(item);

      return {
        ...item,
        id: `edu-${index + 1}`,
        startDate: toYear(item.startDate),
        endDate: current ? "" : toYear(item.endDate),
        current,
      };
    }),
    projects: converted.projects.map((item, index) => ({
      ...item,
      id: `project-${index + 1}`,
      link: toHttpUrl(item.link),
      linkLabel: "",
      showLinkAsText: true,
    })),
    skills: converted.skills.map((item, index) => ({ ...item, id: `skills-${index + 1}` })),
    updatedAt: new Date().toISOString(),
  });
}
