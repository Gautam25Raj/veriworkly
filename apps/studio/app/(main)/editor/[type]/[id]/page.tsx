import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { getDocumentDefinition } from "@/features/documents/core/registry";
import { parseDocumentRouteSegment } from "@/features/documents/core/routes";

import { EditorEntryRedirect } from "../../EditorEntryRedirect";

interface Params {
  type: string;
  id: string;
}

/**
 * Generic on purpose: documents live on the device, so the server cannot know the title.
 * The editor puts the document's own title in the tab once it has loaded it.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { type } = await params;
  const documentType = parseDocumentRouteSegment(type);

  return {
    title: documentType ? `${getDocumentDefinition(documentType).label} editor` : "Editor",
    description: "Edit documents in VeriWorkly Studio.",
    robots: { index: false, follow: false },
  };
}

export default async function EditorByTypePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { type, id } = await params;
  const { template } = await searchParams;

  const documentType = parseDocumentRouteSegment(type);

  if (!documentType) notFound();

  if (id === "new") {
    // Only a template the link named; see the same rule in `app/(main)/editor/page.tsx`.
    const requestedTemplate = getDocumentDefinition(documentType).templates.find(
      (item) => item.id === template,
    );

    return <EditorEntryRedirect type={documentType} templateId={requestedTemplate?.id} />;
  }

  const Editor = getDocumentDefinition(documentType).Editor;

  return <Editor documentId={id} />;
}
