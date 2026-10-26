/**
 * "1 section", "2 sections", "0 sections". English only; pass `plural` for irregular nouns.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
