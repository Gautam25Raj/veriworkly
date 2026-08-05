import { loadWorkspaceBootstrap } from "@/lib/workspace-bootstrap";

import { WorkspaceProvider } from "@/components/WorkspaceProvider";

/**
 * The editor's own provider. It deliberately skips analytics — nothing under
 * `/editor` reads it, and awaiting it here would put that query on the editor's
 * time-to-first-byte for no benefit.
 */
const EditorLayout = async ({ children }: { children: React.ReactNode }) => {
  const bootstrap = await loadWorkspaceBootstrap();

  return <WorkspaceProvider initialData={bootstrap}>{children}</WorkspaceProvider>;
};

export default EditorLayout;
