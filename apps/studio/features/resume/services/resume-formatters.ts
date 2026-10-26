"use client";

import type { ResumeData } from "@/types/resume";

import {
  safeText,
  formatDateRange,
  sanitizeFileName,
  escapeHtml,
} from "@/features/documents/utils/formatters";

export { safeText, formatDateRange, escapeHtml };

export function getResumeFileBaseName(resume: ResumeData): string {
  return sanitizeFileName(resume.title || resume.basics.fullName) || "resume";
}
