import type { PageData } from "fumadocs-core/source";
import type { DocData, DocMethods } from "fumadocs-mdx/runtime/types";

import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

import { blogPosts } from "collections/server";
import type { BlogFrontmatter } from "@/lib/blog-frontmatter";

/**
 * A loaded blog post: validated frontmatter plus everything fumadocs-mdx attaches to a doc
 * (`body`, `toc`, `structuredData`, file info).
 *
 * Spelled out rather than inferred from `typeof blogPosts`: the generated `.source/server.ts`
 * carries an empty per-collection type config, so inference there collapses to bare `PageData`
 * and every frontmatter field is lost.
 */
export type BlogPostPage = BlogFrontmatter & DocData & DocMethods & PageData;

export const blog = loader({
  baseUrl: "/",
  source: toFumadocsSource<BlogPostPage, never>(blogPosts as BlogPostPage[], []),
});
