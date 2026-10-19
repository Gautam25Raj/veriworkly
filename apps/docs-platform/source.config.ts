import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export const api = defineDocs({
  dir: "content/api-reference",
});

export const engine = defineDocs({
  dir: "content/ats-engine",
  // Kept as Markdown for /ats-engine/llms-full.txt.
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

export default defineConfig();
