import dynamic from "next/dynamic";

import type { ResumeData } from "@/types/resume";
import type { CoverLetterContent } from "@/features/cover-letter/types";

import type { BaseDocument, ExportFormat } from "./types";
import type { DocumentType } from "./document-types";
import type { DocumentDefinition, DocumentExporter } from "./definition";

import { templateCatalogByType } from "./template-catalog";

import {
  createDefaultCoverLetter,
  COVER_LETTER_TEMPLATE_ID,
} from "@/features/cover-letter/defaults";
import { parseCoverLetterDocument } from "@/features/cover-letter/schema";

import { defaultResume } from "@/features/resume/constants/default-resume";
import { parseResumeDataInput } from "@/features/resume/schemas/resume-storage-schema";

const ResumeEditor = dynamic(() => import("@/features/resume/editor/ResumeEditor"));
const CoverLetterEditor = dynamic(() => import("@/features/cover-letter/editor/CoverLetterEditor"));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function wrapResumeDocument(id: string): BaseDocument {
  const now = new Date().toISOString();

  const resume = {
    ...structuredClone(defaultResume),
    id,
    updatedAt: now,
  };

  return {
    id: resume.id,
    type: "RESUME",
    title: resume.basics.fullName || "Resume",
    templateId: resume.templateId,
    content: resume,
    updatedAt: resume.updatedAt,
    sync: resume.sync,
  };
}

function parseResumeDocument(input: unknown): BaseDocument | null {
  const document = isRecord(input) ? input : {};
  const resumeInput = isRecord(document.content) ? document.content : input;
  const resume = parseResumeDataInput(resumeInput);

  if (!resume) return null;

  const id = typeof document.id === "string" ? document.id : resume.id;
  const templateId =
    typeof document.templateId === "string" ? document.templateId : resume.templateId;
  const updatedAt = typeof document.updatedAt === "string" ? document.updatedAt : resume.updatedAt;
  const sync = isRecord(document.sync) ? { ...resume.sync, ...document.sync } : resume.sync;

  const content = {
    ...resume,
    id,
    templateId,
    updatedAt,
    sync,
  };

  return {
    id,
    type: "RESUME",
    title:
      (typeof document.title === "string" && document.title) || content.basics.fullName || "Resume",
    templateId,
    content,
    updatedAt,
    sync,
  };
}

function describeResume(document: BaseDocument): string {
  const resume = document.content as ResumeData;
  return resume.basics?.role || "Role not set";
}

function describeCoverLetter(document: BaseDocument): string {
  const content = document.content as Partial<CoverLetterContent>;

  return (
    [content.jobTitle, content.companyName].filter(Boolean).join(" at ") ||
    content.subject ||
    "Cover letter"
  );
}

/**
 * Both loaders are `import()`ed, not statically imported. That boundary is what keeps
 * `@react-pdf/renderer` and `docx` out of the list/editor route bundles — see
 * export-dispatcher.tsx. Do not "simplify" these into top-level imports.
 */
async function loadResumeExporter(format: ExportFormat): Promise<DocumentExporter> {
  const { exportResumeDocument } = await import("@/features/documents/export/resume-exporters");
  return (document) => exportResumeDocument(document, format);
}

async function loadCoverLetterExporter(format: ExportFormat): Promise<DocumentExporter> {
  const { exportCoverLetterDocument } =
    await import("@/features/documents/export/cover-letter-exporters");
  return (document) => exportCoverLetterDocument(document, format);
}

export const documentRegistry: Record<DocumentType, DocumentDefinition> = {
  RESUME: {
    type: "RESUME",
    label: "Resume",
    icon: "FileText",
    defaultTemplateId: "executive-clarity",
    exportFormats: ["pdf", "docx", "html", "markdown", "json", "txt"],
    templates: templateCatalogByType.RESUME,
    createDefault: wrapResumeDocument,
    parse: parseResumeDocument,
    describe: describeResume,
    Editor: ResumeEditor,
    loadExporter: loadResumeExporter,
  },

  COVER_LETTER: {
    type: "COVER_LETTER",
    label: "Cover Letter",
    icon: "Mail",
    defaultTemplateId: COVER_LETTER_TEMPLATE_ID,
    exportFormats: ["pdf", "docx", "html", "markdown", "txt", "json"],
    templates: templateCatalogByType.COVER_LETTER,
    createDefault: createDefaultCoverLetter,
    parse: parseCoverLetterDocument,
    describe: describeCoverLetter,
    Editor: CoverLetterEditor,
    loadExporter: loadCoverLetterExporter,
  },
};

export function getDocumentDefinition(type: DocumentType) {
  return documentRegistry[type];
}
