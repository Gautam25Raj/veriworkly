import { AtSign, FileSearch, LayoutList, ShieldAlert, Type, type LucideIcon } from "lucide-react";

/**
 * Display metadata for the deterministic engine's rule categories. The engine sends category
 * *keys*; the labels, ordering, and plain-language descriptions live here so a policy update
 * never has to ship copy, and an unrecognised key still renders (see `categoryMeta`).
 */
const CATEGORY_META: Record<string, { label: string; icon: LucideIcon; blurb: string }> = {
  parse: {
    label: "Parsing",
    icon: FileSearch,
    blurb: "Whether a parser can read the document at all: length, encoding, and stray glyphs.",
  },
  contact: {
    label: "Contact & links",
    icon: AtSign,
    blurb: "Email, phone, and a professional link, placed where an ATS looks for them.",
  },
  structure: {
    label: "Structure",
    icon: LayoutList,
    blurb: "Clearly labelled Experience, Education, and Skills sections an ATS can map.",
  },
  content: {
    label: "Evidence",
    icon: Type,
    blurb: "Action verbs, quantified outcomes, and length a recruiter can skim.",
  },
  format: {
    label: "Format risk",
    icon: ShieldAlert,
    blurb: "Tables, columns, and repeated headers that scramble content during extraction.",
  },
};

const CATEGORY_ORDER = ["parse", "contact", "structure", "content", "format"];

export function categoryMeta(category: string) {
  return (
    CATEGORY_META[category] ?? {
      label: category.charAt(0).toUpperCase() + category.slice(1),
      icon: FileSearch,
      blurb: "",
    }
  );
}

/** Stable presentation order: known categories first in reading order, then anything new. */
export function sortByCategoryOrder<T extends { category: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = CATEGORY_ORDER.indexOf(a.category);
    const right = CATEGORY_ORDER.indexOf(b.category);
    return (
      (left === -1 ? CATEGORY_ORDER.length : left) - (right === -1 ? CATEGORY_ORDER.length : right)
    );
  });
}

/**
 * Score bands, shared by the gauge, the category bars, and the verdict copy so a "78" never
 * reads as green in one place and amber in another.
 */
export type ScoreTone = "good" | "warn" | "bad";

export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

/**
 * `text-emerald-600` / `text-amber-600` / `text-red-600` clear 4.5:1 on white; their 400-level
 * counterparts clear it on the near-black dark ground. The 500-level fills are decorative
 * (bars and rings), where the 3:1 non-text threshold applies.
 */
export const TONE_CLASSES: Record<ScoreTone, { text: string; fill: string; chip: string }> = {
  good: {
    text: "text-emerald-700 dark:text-emerald-400",
    fill: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  warn: {
    text: "text-amber-700 dark:text-amber-400",
    fill: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  bad: {
    text: "text-red-700 dark:text-red-400",
    fill: "bg-red-500",
    chip: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
};
