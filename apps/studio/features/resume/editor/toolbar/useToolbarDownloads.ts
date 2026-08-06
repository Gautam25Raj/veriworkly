"use client";

import { useState } from "react";

import type { ResumeData } from "@/types/resume";

import { trackUsageEvent } from "@/features/analytics/services/usage-metrics";

/**
 * Every handler resolves its exporter through a dynamic `import()` at click time.
 *
 * These modules statically pull in `@react-pdf/renderer` (~1.8MB) and `docx` (~390KB).
 * Importing them at the top of this file put both into the editor's initial bundle —
 * and, via the re-export chain through resume-service, into the document list and
 * dashboard bundles too. Nobody needs a PDF engine until they click Download.
 */
export const useToolbarDownloads = (
  resume: ResumeData,
  resumePreviewId: string,
  onMessage: (msg: string) => void,
) => {
  const [activeDownload, setActiveDownload] = useState<string | null>(null);

  const runDownload = async (
    key: string,
    label: string,
    run: () => void | Promise<void>,
  ): Promise<void> => {
    setActiveDownload(key);

    try {
      await run();

      onMessage(`${label} downloaded successfully`);
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage(`Could not generate ${label}. Try again.`);
    } finally {
      setActiveDownload(null);
    }
  };

  const onDownloadDocx = () =>
    runDownload("docx", "DOCX", async () => {
      const { exportResumeAsDocx } = await import("@/features/documents/export/export-docx");
      await exportResumeAsDocx(resume);
    });

  const onDownloadPdf = () =>
    runDownload("pdf", "PDF", async () => {
      const { exportResumeAsPdf } = await import("@/features/documents/export/export-pdf");
      await exportResumeAsPdf(resume);
    });

  const onDownloadMarkdown = () =>
    runDownload("markdown", "Markdown", async () => {
      const { exportResumeAsMarkdown } =
        await import("@/features/documents/export/export-markdown");
      exportResumeAsMarkdown(resume);
    });

  const onDownloadHtml = () =>
    runDownload("html", "HTML", async () => {
      const { exportResumeAsHtml } = await import("@/features/documents/export/export-html");
      exportResumeAsHtml(resume, resumePreviewId);
    });

  const onDownloadText = () =>
    runDownload("txt", "Plain text", async () => {
      const { exportResumeAsText } = await import("@/features/documents/export/export-text");
      exportResumeAsText(resume);
    });

  const onDownloadJson = () =>
    runDownload("json", "JSON", async () => {
      const { exportResumeAsJson } = await import("@/features/documents/export/export-json");
      exportResumeAsJson(resume);
    });

  return {
    activeDownload,
    onDownloadDocx,
    onDownloadPdf,
    onDownloadMarkdown,
    onDownloadHtml,
    onDownloadText,
    onDownloadJson,
  };
};
