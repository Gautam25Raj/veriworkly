"use client";

import type { BaseSectionProps } from "./section-types";

import { DelimitedTextArea, Field, TextInputField } from "@/features/documents/editor/form";
import TypedSectionEditor from "./TypedSectionEditor";

const InterestsSection = (props: BaseSectionProps) => {
  return (
    <TypedSectionEditor
      {...props}
      sectionKey="interests"
      sectionId="interests"
      label="Interests"
      addLabel="Add interest"
      fallbackItemLabel="Interest"
      emptyMessage="No interests yet. Click Add interest."
      labelFor={(item) => item.name}
    >
      {({ item: interest, update }) => (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInputField
            label="Interest"
            value={interest.name}
            onValueChange={(name) => update({ name })}
          />

          {/* Children-based `Field`: DelimitedTextArea holds a local draft string, so a
              typed comma survives until the next keyword is started. */}
          <Field label="Keywords (comma separated)">
            <DelimitedTextArea
              className="min-h-11"
              delimiter="comma"
              key={interest.id}
              onChange={(keywords) => update({ keywords })}
              value={interest.keywords}
            />
          </Field>
        </div>
      )}
    </TypedSectionEditor>
  );
};

export default InterestsSection;
