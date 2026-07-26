"use client";

import { useState } from "react";

import type { ResumeData } from "@/types/resume";

import {
  exportResumeAsPdf,
  exportResumeAsHtml,
  exportResumeAsJson,
  exportResumeAsDocx,
  exportResumeAsText,
  exportResumeAsMarkdown,
} from "@/features/resume/services/resume-service";
import { trackUsageEvent } from "@/features/analytics/services/usage-metrics";

export const useToolbarDownloads = (
  resume: ResumeData,
  resumePreviewId: string,
  onMessage: (msg: string) => void,
) => {
  const [activeDownload, setActiveDownload] = useState<string | null>(null);

  const onDownloadDocx = async () => {
    setActiveDownload("docx");
    try {
      await exportResumeAsDocx(resume);

      onMessage("DOCX downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate DOCX. Try again.");
    } finally {
      setActiveDownload(null);
    }
  };

  const onDownloadPdf = async () => {
    setActiveDownload("pdf");

    try {
      await exportResumeAsPdf(resume);

      onMessage("PDF downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate PDF. Try again.");
    } finally {
      setActiveDownload(null);
    }
  };

  const onDownloadMarkdown = () => {
    try {
      exportResumeAsMarkdown(resume);

      onMessage("Markdown downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate Markdown. Try again.");
    }
  };

  const onDownloadHtml = () => {
    try {
      exportResumeAsHtml(resume, resumePreviewId);

      onMessage("HTML downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate HTML. Try again.");
    }
  };

  const onDownloadText = () => {
    try {
      exportResumeAsText(resume);

      onMessage("Plain text downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate plain text. Try again.");
    }
  };

  const onDownloadJson = () => {
    try {
      exportResumeAsJson(resume);

      onMessage("JSON downloaded successfully");
      trackUsageEvent({ event: "resume_exported" });
    } catch {
      onMessage("Could not generate JSON. Try again.");
    }
  };

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
