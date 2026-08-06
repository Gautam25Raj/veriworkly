import fs from "fs";
import path from "path";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const WORDS_PER_MINUTE = 200;

export type PostStats = { words: number; minutes: number; label: string };

/**
 * The archive renders every post in one pass, so an uncached implementation performs a
 * synchronous disk read per post per render. Memoised by filename: the build process is
 * short-lived and content cannot change within it.
 */
const cache = new Map<string, PostStats>();

export function getPostStats(filename: string): PostStats {
  const cached = cache.get(filename);
  if (cached) return cached;

  let stats: PostStats = { words: 0, minutes: 5, label: "5 min read" };

  try {
    const fullPath = path.join(process.cwd(), "content", "blog", filename);

    // Frontmatter is metadata, not prose — counting it inflates long posts,
    // which now carry sizeable `faq` and `tags` blocks.
    const content = fs.readFileSync(fullPath, "utf-8").replace(FRONTMATTER, "");
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

    stats = { words, minutes, label: `${minutes} min read` };
  } catch (error) {
    console.error("Error reading post content for read time calculation:", error);
  }

  cache.set(filename, stats);

  return stats;
}

export function getReadingTime(filename: string): string {
  return getPostStats(filename).label;
}
