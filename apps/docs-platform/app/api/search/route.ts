import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { AdvancedIndex } from "fumadocs-core/search/server";

import { createSearchAPI } from "fumadocs-core/search/server";

import { source, engineSource } from "@/lib/source";

type IndexedPage =
  ReturnType<typeof source.getPages>[number] | ReturnType<typeof engineSource.getPages>[number];

function toIndex(page: IndexedPage, breadcrumbs: string[]): AdvancedIndex {
  const data = page.data as unknown as {
    title?: string;
    description?: string;
    structuredData: StructuredData;
  };

  return {
    id: page.url,
    url: page.url,
    title: data.title ?? page.url,
    description: data.description,
    breadcrumbs,
    structuredData: data.structuredData,
  };
}

export const { GET } = createSearchAPI("advanced", {
  language: "english",
  indexes: () => [
    ...source.getPages().map((page) => toIndex(page, ["Docs"])),
    ...engineSource.getPages().map((page) => toIndex(page, ["ATS Engine"])),
  ],
});
