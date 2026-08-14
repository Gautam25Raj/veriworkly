"use client";

import { Save } from "lucide-react";

import { Button } from "@veriworkly/ui";

/**
 * Manual save. Shared so both editors present the same control — the resume had this as
 * a store-bound component and the cover letter hand-rolled its own inline button.
 *
 * Surfacing save failures is the caller's job, via `describeSaveResult`.
 */
const ToolbarSaveButton = ({ onSave }: { onSave: () => void }) => {
  return (
    <Button onClick={onSave} size="sm" variant="secondary" className="rounded-xl">
      <Save className="mr-2 h-4 w-4" />
      Save
    </Button>
  );
};

export default ToolbarSaveButton;
