import type { ResumeData } from "@/types/resume";

import { getResumeFileBaseName } from "@/features/resume/services/resume-formatters";

import { downloadBlob } from "./download";

/**
 * The backup the user takes when something else is failing, so it validates nothing: the
 * store's value is already a normalised resume, and a field that is not finished yet (a
 * half-typed email) must not cost them the file.
 */
export function exportResumeAsJson(resume: ResumeData): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${getResumeFileBaseName(resume)}.json`);
}
