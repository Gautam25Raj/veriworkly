import { loadWorkspaceBootstrap } from "@/lib/workspace-bootstrap";

import { WorkspaceProvider } from "@/components/WorkspaceProvider";

/**
 * The portfolio store lives here, above both `/editor` and the dashboard routes, so it
 * survives navigation between them. Mounting a provider per route group instead would
 * give each a fresh store, discarding in-memory edits that had not yet hit the 12s
 * autosave when the user left the editor.
 *
 * Analytics is deliberately *not* fetched at this level — see `(dashboard)/layout.tsx`.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const bootstrap = await loadWorkspaceBootstrap();

  return <WorkspaceProvider initialData={bootstrap}>{children}</WorkspaceProvider>;
}
