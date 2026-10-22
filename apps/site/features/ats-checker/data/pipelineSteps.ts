export const PIPELINE_STEPS = [
  {
    phase: "Upload",
    title: "Converted to plain text",
    body: "A PDF is a series of vector drawing coordinates, not plain text. Extraction rebuilds reading order, which is why multi-column layouts, graphics, and text boxes get scrambled.",
  },
  {
    phase: "Extract",
    title: "Mapped into database fields",
    body: "Name, phone, email, job titles, companies, and employment dates are parsed into columns. Anything unmapped stays invisible in recruiter dashboards.",
  },
  {
    phase: "Search",
    title: "Filtered by recruiter queries",
    body: "Hiring managers filter candidates by required skills, titles, and exact keywords. A skill placed in an image or an unusual phrase never reaches the index.",
  },
  {
    phase: "Review",
    title: "Read by a person",
    body: "Once you pass the search, a recruiter opens your original PDF. Both the parsed text and the visual document have to hold up.",
  },
] as const;
