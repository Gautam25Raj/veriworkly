import type { ComponentType } from "react";
import type { TemplateMeta } from "@/features/documents/core/types";
import type { TemplateRenderProps } from "@/types/template";

import { resumeTemplateRegistry } from "./resume/registry";

export { resumeTemplateRegistry };
export { coverLetterTemplateRegistry } from "./cover-letter/registry";

/**
 * Resume template metadata, in display order. Metadata only — the renderers are
 * lazy, so use {@link loadTemplateComponentById} to get a component.
 */
export const templateRegistry: TemplateMeta[] = resumeTemplateRegistry.metas;
export const resumeTemplateMetas: TemplateMeta[] = resumeTemplateRegistry.metas;

/**
 * Resolves a resume's web renderer. Async because the template module is fetched on
 * demand; unknown ids fall back to the first template rather than throwing.
 */
export const loadTemplateComponentById = (
  id: string | undefined,
): Promise<ComponentType<TemplateRenderProps>> => resumeTemplateRegistry.loadWeb(id);

export const getTemplateById = (id: string | undefined): TemplateMeta | undefined =>
  resumeTemplateRegistry.has(id) ? resumeTemplateRegistry.getMeta(id) : undefined;
