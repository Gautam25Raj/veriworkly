import type { PortfolioWorkspaceBootstrap } from "@/store/portfolio-store";

import { isAdminUser } from "@/lib/admin";
import { fetchServerApiData } from "@/lib/server-api";

import { WorkspaceProvider } from "@/components/WorkspaceProvider";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [user, workspace, analytics] = await Promise.all([
    fetchServerApiData<PortfolioWorkspaceBootstrap["user"]>("/users/me"),
    fetchServerApiData<PortfolioWorkspaceBootstrap["workspace"]>("/portfolios/me"),
    fetchServerApiData<PortfolioWorkspaceBootstrap["analytics"]>("/portfolios/analytics"),
  ]);

  // The dashboard/editor stays open in production for every user — only the publish action
  // itself is blocked there for non-admins (see EditorCommandBar.tsx and the server's
  // PortfolioController.publish, which is the actual enforcement point). `isAdmin` is computed
  // here, server-side, from the server-only ADMIN_EMAIL — never send the email itself to the
  // client, only this boolean.
  const isAdmin = isAdminUser(user);

  return (
    <WorkspaceProvider initialData={{ user, workspace, analytics, isAdmin }}>
      {children}
    </WorkspaceProvider>
  );
}
