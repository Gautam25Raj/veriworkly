import "server-only";

import type { PortfolioWorkspaceBootstrap } from "@/store/portfolio-store";

import { isAdminUser } from "@/lib/admin";
import { fetchServerApiData } from "@/lib/server-api";

export interface WorkspaceBootstrap extends PortfolioWorkspaceBootstrap {
  isAdmin: boolean;
}

/**
 * Server-side bootstrap for a workspace route group.
 *
 * `includeAnalytics` exists because the editor doesn't consume analytics at all —
 * it only needs `isAdmin` for the publish gate. Fetching analytics for every route
 * put a query the editor never reads (an aggregate, two groupBys and a Redis read)
 * on its critical path, since the layout awaits the whole batch before rendering.
 *
 * The underlying `fetchServerApiData` is `cache()`-wrapped, so the nested dashboard
 * layout asking for the same two endpoints costs nothing extra within one request.
 */
export async function loadWorkspaceBootstrap({
  includeAnalytics = false,
}: { includeAnalytics?: boolean } = {}): Promise<WorkspaceBootstrap> {
  const [user, workspace, analytics] = await Promise.all([
    fetchServerApiData<PortfolioWorkspaceBootstrap["user"]>("/users/me"),
    fetchServerApiData<PortfolioWorkspaceBootstrap["workspace"]>("/portfolios/me"),
    includeAnalytics
      ? fetchServerApiData<PortfolioWorkspaceBootstrap["analytics"]>("/portfolios/analytics")
      : Promise.resolve(null),
  ]);

  // The dashboard/editor stays open in production for every user — only the publish action
  // itself is blocked there for non-admins (see EditorCommandBar.tsx and the server's
  // PortfolioController.publish, which is the actual enforcement point). `isAdmin` is computed
  // here, server-side, from the server-only ADMIN_EMAIL — never send the email itself to the
  // client, only this boolean.
  return { user, workspace, analytics, isAdmin: isAdminUser(user) };
}
