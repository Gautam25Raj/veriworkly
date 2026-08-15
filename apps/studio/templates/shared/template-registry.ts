import type { ComponentType } from "react";

import type { TemplateMeta } from "@/features/documents/core/types";

/**
 * One template: its metadata (always loaded) plus lazy loaders for its two
 * renderers (loaded on demand).
 *
 * Metadata is eager because pickers, catalogs, and library cards need names and
 * preview images without rendering anything. The renderers are lazy because a
 * document only ever uses one of them at a time, and the PDF renderers pull in
 * `@react-pdf/renderer`.
 */
export interface TemplateEntry<TWebProps, TPdfProps> {
  meta: TemplateMeta;
  loadWeb: () => Promise<ComponentType<TWebProps>>;
  loadPdf: () => Promise<ComponentType<TPdfProps>>;
}

export interface TemplateRegistry<TWebProps, TPdfProps> {
  /** Metadata for every template, in display order. */
  metas: TemplateMeta[];
  ids: string[];
  has: (id: string | undefined) => boolean;
  /** Metadata for `id`, falling back to the first template for unknown ids. */
  getMeta: (id: string | undefined) => TemplateMeta;
  loadWeb: (id: string | undefined) => Promise<ComponentType<TWebProps>>;
  loadPdf: (id: string | undefined) => Promise<ComponentType<TPdfProps>>;
}

/**
 * Builds a registry of lazily-loaded templates, shared by resumes and cover letters.
 *
 * Both document types previously had their own shape for this: resumes had an eager
 * array with a `renderWeb` wrapper (and a comment claiming it was dynamic when it
 * was not), while cover letters had no registry at all — just `if (templateId === X)`
 * branches duplicated across `web.tsx` and `pdf.tsx`. Adding a cover letter template
 * meant editing those branches; adding a resume template meant editing an array.
 * Now both describe themselves the same way and resolve through the same code.
 *
 * Resolved components are memoized per id, so switching templates back and forth
 * costs one module fetch each, not one per switch.
 *
 * Unknown ids fall back to the first entry rather than throwing: a document whose
 * `templateId` predates a rename must still render.
 */
export function createTemplateRegistry<TWebProps, TPdfProps>(
  entries: TemplateEntry<TWebProps, TPdfProps>[],
): TemplateRegistry<TWebProps, TPdfProps> {
  if (entries.length === 0) {
    throw new Error("createTemplateRegistry: at least one template is required");
  }

  const byId = new Map(entries.map((entry) => [entry.meta.id, entry]));
  const fallback = entries[0];

  const webCache = new Map<string, Promise<ComponentType<TWebProps>>>();
  const pdfCache = new Map<string, Promise<ComponentType<TPdfProps>>>();

  const resolve = (id: string | undefined) => byId.get(id ?? "") ?? fallback;

  function load<TProps>(
    id: string | undefined,
    cache: Map<string, Promise<ComponentType<TProps>>>,
    loader: (entry: TemplateEntry<TWebProps, TPdfProps>) => Promise<ComponentType<TProps>>,
  ): Promise<ComponentType<TProps>> {
    const entry = resolve(id);
    const cached = cache.get(entry.meta.id);

    if (cached) return cached;

    // A rejected import must not be cached, or one transient network failure would
    // make that template permanently unrenderable for the rest of the session.
    const pending = loader(entry).catch((error: unknown) => {
      cache.delete(entry.meta.id);
      throw error;
    });

    cache.set(entry.meta.id, pending);

    return pending;
  }

  return {
    metas: entries.map((entry) => entry.meta),
    ids: entries.map((entry) => entry.meta.id),
    has: (id) => byId.has(id ?? ""),
    getMeta: (id) => resolve(id).meta,
    loadWeb: (id) => load(id, webCache, (entry) => entry.loadWeb()),
    loadPdf: (id) => load(id, pdfCache, (entry) => entry.loadPdf()),
  };
}
