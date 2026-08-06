"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import type { PortfolioWorkspaceBootstrap } from "@/store/portfolio-store";

import { usePortfolioStore } from "@/store/portfolio-store";
import { loadPortfolioCache } from "@/lib/portfolio-storage";

interface WorkspaceContextType {
  user: PortfolioWorkspaceBootstrap["user"];
  workspace: PortfolioWorkspaceBootstrap["workspace"];
  analytics: PortfolioWorkspaceBootstrap["analytics"];
  isAdmin: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: WorkspaceContextType;
}) {
  const load = usePortfolioStore((state) => state.loadWorkspace);
  const hydrate = usePortfolioStore((state) => state.hydrateWorkspace);

  // Hydrate the Zustand store with the server-fetched data or trigger client load if null
  useEffect(() => {
    if (initialData.user || initialData.workspace) {
      if (initialData.workspace) hydrate(initialData);
      else void load();
    } else {
      // Guest mode! Hydrate using local data only, do not load from server
      const cached = loadPortfolioCache();
      hydrate({
        user: null,
        workspace: cached
          ? {
              draft: {
                id: "guest",
                slug: cached.slug,
                templateId: cached.content.templateId,
                content: cached.content,
                revision: 1,
                updatedAt: new Date().toISOString(),
              },
              billing: { canPublish: false, status: "INACTIVE" },
              publication: null,
            }
          : null,
        analytics: null,
      });
    }
  }, [hydrate, initialData, load]);

  // Read state reactively from Zustand store so that any client-side loading updates the context dynamically
  const user = usePortfolioStore((state) => state.user);
  const draft = usePortfolioStore((state) => state.draft);
  const ready = usePortfolioStore((state) => state.ready);
  const billing = usePortfolioStore((state) => state.billing);
  const publication = usePortfolioStore((state) => state.publication);
  const analyticsData = usePortfolioStore((state) => state.analyticsData);

  // Until the store has been hydrated, serve the server-fetched bootstrap directly.
  //
  // The store is a module-level singleton and hydration happens in an effect, so this
  // used to hand every consumer nulls during SSR *and* during the first client render —
  // the dashboard shipped HTML reading "Good morning, there", 0 views and 0% readiness,
  // then swapped in the real values on hydration. The server already had the data; it
  // was simply being thrown away, costing a full render pass and a layout shift.
  //
  // Falling back to `initialData` (rather than seeding the store during render) is
  // deliberate: writing per-user data into a module-level store on the server would
  // make it readable by other in-flight requests. This keeps server rendering read-only,
  // and because the same `initialData` is used for both the server pass and the first
  // client pass, the two agree and there is nothing for React to reconcile.
  const contextValue = useMemo<WorkspaceContextType>(
    () =>
      ready
        ? {
            user,
            workspace: { draft, publication, billing },
            analytics: analyticsData,
            isAdmin: initialData.isAdmin,
          }
        : initialData,
    [ready, user, draft, publication, billing, analyticsData, initialData],
  );

  return <WorkspaceContext.Provider value={contextValue}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) throw new Error("useWorkspace must be used within a WorkspaceProvider");

  return context;
}
