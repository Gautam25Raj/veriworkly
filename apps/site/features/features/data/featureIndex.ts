import type { FeatureIndexItem } from "../types";

/** The contents list under the /features headline. Each `id` is a section on the page. */
export const FEATURE_INDEX: FeatureIndexItem[] = [
  {
    id: "studio",
    title: "Document Studio",
    summary: "Resumes and matched cover letters, tailored per job.",
  },
  {
    id: "ai-tailoring",
    title: "AI tailoring",
    summary: "Suggestions you review side by side before anything changes.",
  },
  {
    id: "imports",
    title: "Profile import",
    summary: "Your GitHub projects and LinkedIn history, without retyping.",
  },
  {
    id: "ats",
    title: "ATS scoring",
    summary: "Check a resume against the job you are applying for.",
  },
  {
    id: "portfolio",
    title: "Web portfolio",
    summary: "A personal site at yourname.veriworkly.com.",
  },
  {
    id: "exports",
    title: "Export formats",
    summary: "PDF, Word, Markdown, HTML, text and JSON, all free.",
  },
];
