"use client";

import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { BaseDocument } from "@/features/documents/core/types";
import type { DocumentType } from "@/features/documents/core/document-types";

import {
  saveDocument,
  createDocumentFromMasterProfile,
} from "@/features/documents/services/document-workspace-service";
import { getDocumentEditorPath } from "@/features/documents/core/routes";
import { describeSaveResult } from "@/features/documents/services/save-failure-message";

interface EditorEntryRedirectProps {
  type: DocumentType;
  templateId?: string;
}

function applyTemplate(document: BaseDocument, templateId: string | undefined): BaseDocument {
  if (!templateId || document.templateId === templateId) return document;

  const content =
    typeof document.content === "object" && document.content !== null
      ? { ...document.content, templateId }
      : document.content;

  return {
    ...document,
    templateId,
    content,
    updatedAt: new Date().toISOString(),
  };
}

export function EditorEntryRedirect({ type, templateId }: EditorEntryRedirectProps) {
  const router = useRouter();
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    // Fire-and-forget: the effect cannot be async, and the profile fetch inside
    // createDocumentFromMasterProfile is what makes this path await at all.
    void (async () => {
      const created = await createDocumentFromMasterProfile(type);
      const createFailure = describeSaveResult(created.saveResult);

      if (createFailure) {
        toast.error(`Could not create the document: ${createFailure}`);
        router.replace("/documents");
        return;
      }

      const document = applyTemplate(created, templateId);

      if (document.templateId === templateId) {
        const templateFailure = describeSaveResult(saveDocument(document, { flush: true }));

        // The document exists either way; only the chosen template did not stick.
        if (templateFailure) toast.error(`Could not apply the template: ${templateFailure}`);
      }

      router.replace(getDocumentEditorPath(type, document.id));
    })();
  }, [router, templateId, type]);

  return null;
}
