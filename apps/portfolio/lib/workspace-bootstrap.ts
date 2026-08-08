import "server-only";

import type { PortfolioWorkspaceBootstrap } from "@/store/portfolio-store";

import { isAdminUser } from "@/lib/admin";
import { fetchServerApiData } from "@/lib/server-api";

export interface WorkspaceBootstrap {
  user: PortfolioWorkspaceBootstrap["user"];
  workspace: PortfolioWorkspaceBootstrap["workspace"];
  isAdmin: boolean;
}

/**
 * Server-side bootstrap shared by every workspace route.
 *
 * Analytics is deliberately absent: only the dashboard routes render it, and it is
 * fetched there instead so `/editor` doesn't wait on a query it never reads.
 *
 * `fetchServerApiData` is `cache()`-wrapped, so calling this from both the workspace
 * layout and the nested dashboard layout costs one round trip per endpoint per request.
 */
export async function loadWorkspaceBootstrap(): Promise<WorkspaceBootstrap> {
  const [user, workspace] = await Promise.all([
    fetchServerApiData<PortfolioWorkspaceBootstrap["user"]>("/users/me"),
    fetchServerApiData<PortfolioWorkspaceBootstrap["workspace"]>("/portfolios/me"),
  ]);

  // The dashboard/editor stays open in production for every user — only the publish action
  // itself is blocked there for non-admins (see EditorCommandBar.tsx and the server's
  // PortfolioController.publish, which is the actual enforcement point). `isAdmin` is computed
  // here, server-side, from the server-only ADMIN_EMAIL — never send the email itself to the
  // client, only this boolean.
  return { user, workspace, isAdmin: isAdminUser(user) };
}
