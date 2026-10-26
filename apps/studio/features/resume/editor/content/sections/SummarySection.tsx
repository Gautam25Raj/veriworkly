"use client";

import type { BaseSectionProps } from "./section-types";

import { useResumeStore } from "@/features/resume/store/resume-store";
import { validateSummary } from "@/features/resume/utils/validation";
import { AiFieldAssist } from "@/features/ai/AiFieldAssist";

import SectionAccordion from "@/features/documents/editor/SectionAccordion";
import { TextAreaField } from "@/features/documents/editor/form";

const SummarySection = ({ isOpen, onToggle }: BaseSectionProps) => {
  const summary = useResumeStore((state) => state.resume.summary);
  const resumeId = useResumeStore((state) => state.resume.id);
  const updateSummary = useResumeStore((state) => state.updateSummary);

  const summaryErrors = validateSummary(summary);

  return (
    <SectionAccordion id="summary" isOpen={isOpen} label="Summary" onToggle={onToggle}>
      <TextAreaField
        className="min-h-40"
        label="Professional summary"
        value={summary}
        error={summaryErrors.summary}
        onValueChange={updateSummary}
      />
      <AiFieldAssist
        action={summary ? "rewrite_section" : "generate_section"}
        getContext={() => {
          const { basics, experience, skills } = useResumeStore.getState().resume;

          return JSON.stringify({ basics, experience, skills });
        }}
        documentId={resumeId}
        onApply={updateSummary}
        text={summary}
      />
    </SectionAccordion>
  );
};

export default SummarySection;
