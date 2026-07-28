import fs from "fs";
import path from "path";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const WORDS_PER_MINUTE = 200;

export function getReadingTime(filename: string): string {
  try {
    const fullPath = path.join(process.cwd(), "content", "blog", filename);

    // Frontmatter is metadata, not prose — counting it inflates long posts,
    // which now carry sizeable `faq` and `tags` blocks.
    const content = fs.readFileSync(fullPath, "utf-8").replace(FRONTMATTER, "");
    const words = content.trim().split(/\s+/).length;

    const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

    return `${minutes} min read`;
  } catch (error) {
    console.error("Error reading post content for read time calculation:", error);
    return "5 min read";
  }
}
