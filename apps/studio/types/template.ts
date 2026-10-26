import type { ComponentType } from "react";

import type { ResumeData } from "@/types/resume";

export interface TemplateRenderProps {
  resume: ResumeData;
  className?: string;
}

export type TemplateComponent = ComponentType<TemplateRenderProps>;
