import { redirect } from "next/navigation";

import { DOCUMENT_TYPES } from "@/features/documents/core/document-types";
import { getDocumentDefinition } from "@/features/documents/core/registry";
import { parseDocumentRouteSegment } from "@/features/documents/core/routes";

import { EditorEntryRedirect } from "./EditorEntryRedirect";

interface EditorEntryPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EditorEntryPage({ searchParams }: EditorEntryPageProps) {
  const params = await searchParams;

  const templateParam = typeof params.template === "string" ? params.template : undefined;
  const typeParam = typeof params.type === "string" ? params.type : DOCUMENT_TYPES[0];
  const type = parseDocumentRouteSegment(typeParam);

  if (!type) redirect("/documents");

  // Only a template the link named: a new document already starts on the type's default, and
  // an existing one opened at the free limit must not have its template replaced by it.
  const requestedTemplate = getDocumentDefinition(type).templates.find(
    (template) => template.id === templateParam,
  );

  return <EditorEntryRedirect type={type} templateId={requestedTemplate?.id} />;
}
