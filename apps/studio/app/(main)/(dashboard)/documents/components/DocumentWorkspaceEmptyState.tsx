"use client";

import { useSyncExternalStore } from "react";
import { FileText } from "lucide-react";

import { CreateDocumentActions } from "./CreateDocumentActions";

const subscribeNever = () => () => {};

export function DocumentWorkspaceEmptyState() {
  // Documents are read from this browser's storage, which the server render cannot see: until
  // hydration the library is unknown, not empty, so it holds the space without claiming either.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  if (!hydrated) return <div className="min-h-72" aria-hidden="true" />;

  return (
    <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <div className="bg-accent/10 text-accent flex h-14 w-14 items-center justify-center rounded-2xl">
        <FileText className="h-7 w-7" />
      </div>

      <h2 className="mt-5 text-xl font-bold">No documents yet</h2>

      <p className="text-muted mt-2 max-w-md text-sm leading-6">
        Start a resume or cover letter, or fill one from your LinkedIn or GitHub profile.
      </p>

      <CreateDocumentActions showImport className="mt-6 justify-center" />
    </div>
  );
}
