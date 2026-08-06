import type { PdfTemplateComponent } from "./types";

import { CompactAtsPdf } from "@/templates/resume/precision-ats/pdf";
import { CleanProfessionalPdf } from "@/templates/resume/executive-clarity/pdf";
import { ModernMinimalPdf } from "@/templates/resume/modern-minimal/pdf";
import { TimelineFocusPdf } from "@/templates/resume/timeline-focus/pdf";
import { BoldImpactPdf } from "@/templates/resume/bold-impact/pdf";
import { CorporateBriefPdf } from "@/templates/resume/corporate-brief/pdf";

export const pdfTemplateRegistry: Record<string, PdfTemplateComponent> = {
  "executive-clarity": CleanProfessionalPdf,
  "precision-ats": CompactAtsPdf,
  "modern-minimal": ModernMinimalPdf,
  "timeline-focus": TimelineFocusPdf,
  "corporate-brief": CorporateBriefPdf,
  "bold-impact": BoldImpactPdf,
};

export function loadTemplatePdfComponentById(id: string | undefined): PdfTemplateComponent {
  return pdfTemplateRegistry[id ?? ""] ?? CleanProfessionalPdf;
}
