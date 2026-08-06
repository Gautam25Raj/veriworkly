import React from "react";

import type { ComponentType } from "react";
import type { TemplateMeta } from "@/features/documents/core/types";
import type { TemplateComponent, TemplateRenderProps } from "@/types/template";

import { precisionAtsMeta } from "./resume/precision-ats/meta";
import { executiveClarityMeta } from "./resume/executive-clarity/meta";
import { modernMinimalMeta } from "./resume/modern-minimal/meta";
import { timelineFocusMeta } from "./resume/timeline-focus/meta";
import { boldImpactMeta } from "./resume/bold-impact/meta";
import { corporateBriefMeta } from "./resume/corporate-brief/meta";

/** A renderable template record used by the web editor. */
export interface TemplateDefinition extends TemplateMeta {
  renderWeb: (props: TemplateRenderProps) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Template registry (web)
//
// These imports are static, and deliberately so — an older comment here claimed
// they were dynamic, which was never true. Every consumer of this module
// (ResumeEditor, the preview route, the parity route, the public share page)
// renders a template immediately, so there is nothing to defer: splitting them
// would add six chunk round trips to save the ~85 lines of skin code per unused
// template, while `templates/resume/shared/web.tsx` — the bulk of the weight — is
// needed by whichever one is selected anyway.
//
// The PDF side is what actually matters for bundle size, and it is already behind
// a dynamic boundary: `templates/resume/pdf` is reached only through
// `features/documents/export/export-pdf`, which is `import()`ed at download time.
// Keep it that way; see features/documents/export/export-dispatcher.tsx.
//
// Adding a template means touching four places, all covered by
// `tests/contracts/template-render.contract.test.tsx`:
//   1. this registry            2. features/documents/core/template-catalog.ts
//   3. templates/resume/pdf     4. public/templates/resume/<id> preview asset
// ---------------------------------------------------------------------------

import { CompactAtsWeb } from "./resume/precision-ats/web";
import { CleanProfessionalWeb } from "./resume/executive-clarity/web";
import { ModernMinimalWeb } from "./resume/modern-minimal/web";
import { TimelineFocusWeb } from "./resume/timeline-focus/web";
import { BoldImpactWeb } from "./resume/bold-impact/web";
import { CorporateBriefWeb } from "./resume/corporate-brief/web";

export const templateRegistry: TemplateDefinition[] = [
  {
    ...executiveClarityMeta,
    renderWeb: (props) => React.createElement(CleanProfessionalWeb, props),
  },
  {
    ...precisionAtsMeta,
    renderWeb: (props) => React.createElement(CompactAtsWeb, props),
  },
  {
    ...modernMinimalMeta,
    renderWeb: (props) => React.createElement(ModernMinimalWeb, props),
  },
  {
    ...timelineFocusMeta,
    renderWeb: (props) => React.createElement(TimelineFocusWeb, props),
  },
  {
    ...corporateBriefMeta,
    renderWeb: (props) => React.createElement(CorporateBriefWeb, props),
  },
  {
    ...boldImpactMeta,
    renderWeb: (props) => React.createElement(BoldImpactWeb, props),
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export const loadTemplateComponentById = (id: string | undefined): TemplateComponent => {
  const match = templateRegistry.find((t) => t.id === id);
  const template = match ?? templateRegistry[0];

  const LoadedTemplate: ComponentType<TemplateRenderProps> = (props) => template.renderWeb(props);

  return LoadedTemplate;
};

export const getTemplateById = (id: string | undefined): TemplateDefinition | undefined =>
  templateRegistry.find((t) => t.id === id);

/** Convenience list of all template metas (no render function). */
