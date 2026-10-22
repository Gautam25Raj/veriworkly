export const SCORE_FACTS = [
  {
    title: "Two scores answer two questions.",
    body: "Readiness measures whether a parser can read your resume cleanly. Job match compares it with one posting's requirements; paste a job description to get it.",
  },
  {
    title: "No ATS has one official score.",
    body: "No ATS vendor publishes a universal score formula, so any tool claiming an official score is estimating. Ours is a public, deterministic rubric you can read rule by rule.",
  },
  {
    title: "Nothing is stored.",
    body: "The scan runs in memory and is discarded when the response is sent. We keep neither your file nor its text, and train nothing on it. The optional AI analysis is the one exception: it sends your resume text to a model provider to write the explanation.",
  },
] as const;
