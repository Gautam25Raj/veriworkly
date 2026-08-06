"use client";

import { createElement, useEffect, useState } from "react";

import type { ResumeData } from "@/types/resume";

import { loadTemplateComponentById } from "@/templates";
import { CoverLetterPreview } from "@/templates/cover-letter/web";
import { ResumePagedPreview } from "@/features/resume/editor/ResumePagedPreview";

import { PARITY_FIXTURES, type ParityFixtureId } from "@/tests/parity/fixtures";

type ParityType = "resume" | "cover-letter";

/**
 * Renders exactly what the editor renders, with nothing else on the page, so a
 * headless browser can read `getBoundingClientRect()` off the same nodes the
 * react-pdf layout tree exposes.
 *
 * `mode=raw` renders the unpaginated document, which isolates box geometry from
 * the pagination algorithm. `mode=paged` renders through `ResumePagedPreview`,
 * which is what the user actually sees.
 */
export function ParityClient({
  fixture,
  mode,
  templateId,
  type,
}: {
  fixture: ParityFixtureId;
  mode: "raw" | "paged";
  templateId: string;
  type: ParityType;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The harness must never measure against fallback metrics.
    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  let body: React.ReactNode;

  if (type === "resume") {
    const resume: ResumeData = { ...PARITY_FIXTURES[fixture].resume(), templateId };
    const element = createElement(loadTemplateComponentById(templateId), { resume });

    body = mode === "paged" ? <ResumePagedPreview>{element}</ResumePagedPreview> : element;
  } else {
    body = (
      <CoverLetterPreview
        content={PARITY_FIXTURES[fixture].coverLetter()}
        templateId={templateId}
      />
    );
  }

  return (
    <main data-parity-mode={mode} data-parity-ready={ready ? "1" : "0"} style={{ padding: 0 }}>
      {body}
    </main>
  );
}
