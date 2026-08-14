"use client";

import { useState } from "react";

import { Button, Select } from "@veriworkly/ui";

import type { CoverLetterSectionId } from "@/features/cover-letter/types";
import type { ResumeLinkDisplayMode, ResumeLinkType } from "@/types/resume";

import { linkTypeOptions } from "@/features/documents/editor/link-options";
import { useCoverLetterStore } from "@/features/cover-letter/store/cover-letter-store";
import SectionAccordion from "@/features/documents/editor/SectionAccordion";
import { AiFieldAssist } from "@/features/ai/AiFieldAssist";

import { EditorBlock, TextAreaField, TextInputField } from "@/features/documents/editor/form";

interface CoverLetterContentPanelProps {
  documentId: string;
}

const EMPTY_LINKS = { displayMode: "icon-username" as const, items: [] };

/**
 * Reads state through narrow store selectors, the same pattern the resume section
 * components use (`features/resume/editor/content/sections/`). It previously took eight
 * props threaded down from the editor.
 */
export function CoverLetterContentPanel({ documentId }: CoverLetterContentPanelProps) {
  const [openSectionId, setOpenSectionId] = useState<CoverLetterSectionId | null>("profile");

  const content = useCoverLetterStore((state) => state.document?.content);
  const onUpdateContent = useCoverLetterStore((state) => state.updateContent);
  const onUpdateLinks = useCoverLetterStore((state) => state.updateLinks);
  const onAddLink = useCoverLetterStore((state) => state.addLinkItem);
  const onUpdateLink = useCoverLetterStore((state) => state.updateLinkItem);
  const onRemoveLink = useCoverLetterStore((state) => state.removeLinkItem);

  function toggleSection(sectionId: string) {
    setOpenSectionId((currentSectionId) =>
      currentSectionId === sectionId ? null : (sectionId as CoverLetterSectionId),
    );
  }

  if (!content) return null;

  const links = content.links ?? EMPTY_LINKS;

  return (
    <div>
      <div className="border-border/70 border-b p-3">
        <h2 className="text-foreground text-base font-semibold">Content editor</h2>
        <p className="text-muted text-sm">Edit cover letter sections.</p>
      </div>

      <SectionAccordion
        id="profile"
        isOpen={openSectionId === "profile"}
        label="Profile"
        onToggle={toggleSection}
      >
        <EditorBlock title="Profile">
          <TextInputField
            label="Full name"
            value={content.senderName}
            onValueChange={(senderName) => onUpdateContent({ senderName })}
          />

          <TextInputField
            label="Professional title"
            value={content.senderTitle}
            onValueChange={(senderTitle) => onUpdateContent({ senderTitle })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInputField
              label="Email"
              value={content.senderEmail}
              onValueChange={(senderEmail) => onUpdateContent({ senderEmail })}
            />

            <TextInputField
              label="Phone"
              value={content.senderPhone}
              onValueChange={(senderPhone) => onUpdateContent({ senderPhone })}
            />
          </div>

          <TextInputField
            label="Location"
            value={content.senderLocation}
            onValueChange={(senderLocation) => onUpdateContent({ senderLocation })}
          />

          <TextInputField
            label="Website"
            value={content.senderWebsite}
            onValueChange={(senderWebsite) => onUpdateContent({ senderWebsite })}
          />
        </EditorBlock>
      </SectionAccordion>

      <SectionAccordion
        id="links"
        isOpen={openSectionId === "links"}
        label="Links"
        onToggle={toggleSection}
      >
        <EditorBlock title="Links">
          <label className="grid gap-1.5">
            <span className="text-muted text-xs font-semibold">Display style</span>

            <Select
              value={links.displayMode}
              onChange={(event) =>
                onUpdateLinks({ displayMode: event.target.value as ResumeLinkDisplayMode })
              }
            >
              <option value="icon">Icons only</option>
              <option value="icon-username">Icon + username</option>
            </Select>
          </label>

          <div className="grid gap-3">
            {links.items.map((item, index) => (
              <div key={item.id} className="border-border grid gap-3 rounded-xl border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-muted text-xs font-semibold">Link type</span>

                    <Select
                      value={item.type}
                      onChange={(event) =>
                        onUpdateLink(index, {
                          type: event.target.value as ResumeLinkType,
                        })
                      }
                    >
                      {linkTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <TextInputField
                    label="Label"
                    value={item.label}
                    placeholder="veriworkly-user"
                    onValueChange={(label) => onUpdateLink(index, { label })}
                  />
                </div>

                <TextInputField
                  label="URL"
                  value={item.url}
                  placeholder="https://..."
                  onValueChange={(url) => onUpdateLink(index, { url })}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-self-start"
                  onClick={() => onRemoveLink(index)}
                >
                  Remove link
                </Button>
              </div>
            ))}
          </div>

          <Button size="sm" variant="secondary" onClick={onAddLink}>
            Add link
          </Button>
        </EditorBlock>
      </SectionAccordion>

      <SectionAccordion
        id="target"
        label="Target"
        onToggle={toggleSection}
        isOpen={openSectionId === "target"}
      >
        <EditorBlock title="Target">
          <TextInputField
            label="Target role"
            value={content.jobTitle}
            onValueChange={(jobTitle) => onUpdateContent({ jobTitle })}
          />

          <TextInputField
            label="Company"
            value={content.companyName}
            onValueChange={(companyName) => onUpdateContent({ companyName })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInputField
              label="Hiring manager"
              value={content.recipientName}
              onValueChange={(recipientName) => onUpdateContent({ recipientName })}
            />

            <TextInputField
              label="Recipient title"
              value={content.recipientTitle}
              onValueChange={(recipientTitle) => onUpdateContent({ recipientTitle })}
            />
          </div>

          <TextInputField
            label="Company location"
            value={content.companyLocation}
            onValueChange={(companyLocation) => onUpdateContent({ companyLocation })}
          />

          <TextInputField
            label="Date"
            value={content.date}
            onValueChange={(date) => onUpdateContent({ date })}
          />
        </EditorBlock>
      </SectionAccordion>

      <SectionAccordion
        id="letter"
        label="Letter"
        onToggle={toggleSection}
        isOpen={openSectionId === "letter"}
      >
        <EditorBlock title="Letter">
          <TextInputField
            label="Subject"
            value={content.subject}
            placeholder="Application for Senior Product Engineer"
            onValueChange={(subject) => onUpdateContent({ subject })}
          />

          <TextInputField
            label="Greeting"
            value={content.greeting}
            onValueChange={(greeting) => onUpdateContent({ greeting })}
          />

          <TextAreaField
            label="Opening"
            value={content.opening}
            onValueChange={(opening) => onUpdateContent({ opening })}
          />

          <TextAreaField
            label="Main body"
            value={content.body}
            className="min-h-44 font-mono text-[13px]"
            onValueChange={(body) => onUpdateContent({ body })}
          />
          <AiFieldAssist
            action="generate_cover_letter"
            context={JSON.stringify(content)}
            documentId={documentId}
            onApply={(body) => onUpdateContent({ body })}
            text={content.body}
          />

          <TextAreaField
            label="Proof points"
            value={content.highlights}
            className="min-h-32 font-mono text-[13px]"
            onValueChange={(highlights) => onUpdateContent({ highlights })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInputField
              label="Closing"
              value={content.closing}
              onValueChange={(closing) => onUpdateContent({ closing })}
            />

            <TextInputField
              label="Signature"
              value={content.signature}
              onValueChange={(signature) => onUpdateContent({ signature })}
            />
          </div>

          <TextInputField
            label="Postscript"
            value={content.postscript}
            onValueChange={(postscript) => onUpdateContent({ postscript })}
          />
        </EditorBlock>
      </SectionAccordion>
    </div>
  );
}
