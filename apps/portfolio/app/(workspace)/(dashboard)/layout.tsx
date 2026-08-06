import type { CloudPortfolioDraft } from "@/lib/portfolio";

import { portfolioWorkspaceUrl } from "@/config/site";
import { isPortfolioPubliclyVisible } from "@/lib/portfolio-status";
import { loadWorkspaceBootstrap } from "@/lib/workspace-bootstrap";

import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { PortfolioAppShell } from "@/components/dashboard/sidebar/PortfolioAppShell";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  // Analytics is fetched here rather than one level up so it stays on the routes
  // that actually render it (overview + analytics) instead of the editor's path.
  const bootstrap = await loadWorkspaceBootstrap({ includeAnalytics: true });

  const draft = bootstrap.workspace?.draft as CloudPortfolioDraft | undefined;

  // Resolved here rather than in the shell so the "View site" button is only rendered
  // when the public site actually resolves, and points at the address this account has
  // (subdomain on Creator Pro, platform path otherwise).
  const publicUrl =
    draft?.slug && isPortfolioPubliclyVisible(bootstrap.workspace?.publication?.status)
      ? portfolioWorkspaceUrl(draft.slug, Boolean(bootstrap.workspace?.billing?.canPublish)).href
      : undefined;

  return (
    <WorkspaceProvider initialData={bootstrap}>
      <PortfolioAppShell user={bootstrap.user} publicUrl={publicUrl}>
        {children}
      </PortfolioAppShell>
    </WorkspaceProvider>
  );
};

export default DashboardLayout;
