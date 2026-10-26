"use client";

import type { BaseDocument } from "@/features/documents/core/types";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { FileSearch } from "lucide-react";

import { Card } from "@veriworkly/ui";

import { loadTemplateComponentById } from "@/templates";
import { useTemplateComponent } from "@/templates/shared/use-template-component";

import { useResumeStore } from "@/features/resume/store/resume-store";
import { readResumeById } from "@/features/resume/services/resume-service";
import { loadDocumentById } from "@/features/documents/services/document-workspace-service";
import type { DocumentType } from "@/features/documents/core/document-types";
import type { CoverLetterContent } from "@/features/cover-letter/types";
import { getDocumentEditorPath } from "@/features/documents/core/routes";
import { CoverLetterPreview } from "@/templates/cover-letter/web";

interface PreviewClientProps {
  documentId: string;
  type: DocumentType;
}

/**
 * Mirrors the hydration gate both editors use, so a miss never flashes before it resolves.
 * One value rather than a status plus a document, so resolving is a single state update.
 */
type Resolved =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; document: BaseDocument | null };

export function PreviewClient({ documentId, type }: PreviewClientProps) {
  // Narrow selectors: subscribing to the whole store re-renders on every unrelated mutation.
  const resume = useResumeStore((state) => state.resume);
  const setResume = useResumeStore((state) => state.setResume);

  const [resolved, setResolved] = useState<Resolved>({ status: "loading" });

  /*
   * Resolution lives in an effect, not a `useMemo`: a memo runs during render, which React
   * is free to run twice, discard, or re-run — and `reactStrictMode` does exactly that in
   * development.
   */
  useEffect(() => {
    const routeResume = type === "RESUME" ? readResumeById(documentId) : null;
    const routeDocument = type === "RESUME" ? null : loadDocumentById(type, documentId);
    const found = type === "RESUME" ? routeResume : routeDocument;

    if (routeResume) setResume(routeResume);

    // Reading local storage on mount is exactly the external-system read this rule carves out.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(found ? { status: "ready", document: routeDocument } : { status: "not-found" });
  }, [documentId, type, setResume]);

  const status = resolved.status;
  const routeDocument = resolved.status === "ready" ? resolved.document : null;

  const TemplateComponent = useTemplateComponent(
    loadTemplateComponentById,
    type === "RESUME" ? resume.templateId : null,
  );
  const title =
    type === "RESUME"
      ? resume.title || resume.basics.fullName || "Untitled Resume"
      : routeDocument?.title;
  const editorPath = getDocumentEditorPath(type, documentId);
  const debugType = type === "COVER_LETTER" ? "cover-letter" : type.toLowerCase();
  const debugTemplateId = type === "RESUME" ? resume.templateId : routeDocument?.templateId;
  const canDebugPdf = type === "RESUME" || type === "COVER_LETTER";

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-border bg-card/95 sticky top-4 z-20 flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
            Document Preview
          </p>
          <p className="text-foreground text-sm font-medium">{title || "Untitled document"}</p>
        </div>

        <div className="flex items-center gap-2">
          {process.env.NODE_ENV === "development" && canDebugPdf && debugTemplateId ? (
            <Link
              href={`/pdf-debug/${debugType}/${debugTemplateId}?id=${documentId}`}
              target="_blank"
              rel="noreferrer"
              className="bg-card text-foreground ring-border hover:bg-background inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium ring-1 transition ring-inset"
            >
              <FileSearch className="mr-2 h-4 w-4" />
              PDF Debug
            </Link>
          ) : null}

          <Link
            href={editorPath}
            className="text-foreground hover:bg-card inline-flex h-9 items-center justify-center rounded-full bg-transparent px-3 text-sm font-medium transition"
          >
            Back to editor
          </Link>
          <Link
            href="/documents"
            className="bg-card text-foreground ring-border hover:bg-background inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium ring-1 transition ring-inset"
          >
            Documents
          </Link>
        </div>
      </div>

      {status === "loading" ? (
        <Card className="space-y-3 text-center">
          <h1 className="text-foreground text-xl font-semibold">Loading preview</h1>
          <p className="text-muted text-sm">Fetching this document from your workspace.</p>
        </Card>
      ) : status === "not-found" ? (
        <Card className="space-y-3 text-center">
          <h1 className="text-foreground text-xl font-semibold">Document not found</h1>
          <p className="text-muted text-sm">
            This document may have been deleted. Return to your documents to pick another one.
          </p>
          <div>
            <Link
              className="bg-card text-foreground ring-border hover:bg-background inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium ring-1 transition ring-inset"
              href="/documents"
            >
              Go to documents
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-4">
          <div className="bg-background rounded-3xl p-4 md:p-6">
            <div className="mx-auto w-full max-w-212.5">
              {type === "RESUME" && TemplateComponent ? (
                createElement(TemplateComponent, { resume })
              ) : type === "COVER_LETTER" && routeDocument ? (
                <CoverLetterPreview
                  content={routeDocument.content as CoverLetterContent}
                  templateId={routeDocument.templateId}
                />
              ) : null}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
