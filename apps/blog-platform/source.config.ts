import { defineCollections, defineConfig } from "fumadocs-mdx/config";

import { blogFrontmatterSchema } from "./lib/blog-frontmatter";

// fumadocs-mdx only allows collection exports from this file, so the frontmatter schema lives in
// `lib/blog-frontmatter.ts` where `lib/source.ts` can also import it.
export const blogPosts = defineCollections({
  type: "doc",
  dir: "content/blog",
  schema: blogFrontmatterSchema,
});

export default defineConfig();
