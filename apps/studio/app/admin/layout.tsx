import type { ReactNode } from "react";
import type { Metadata } from "next";

import { AuthInitializer } from "@/providers/auth-provider";
import AdminShell from "@/components/admin/shell/AdminShell";
import ChartDefs from "@/components/admin/charts/ChartDefs";
import { fetchAdminActionQueue, requireAdminUser } from "@/features/admin/services/admin-server";

export const metadata: Metadata = {
  title: "Admin",
  description: "VeriWorkly admin operations and roadmap management.",
  robots: { index: false, follow: false },
};

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  // Fails closed (404) for any non-admin session — the backend independently re-enforces this
  // on every admin API call, but the frontend must not rely on that alone. Pages are gated too:
  // every admin read awaits the same cached check (see requireAdminUser's doc comment).
  const admin = await requireAdminUser();

  // Drives the sidebar's queue badges. This layout is not re-run on client navigations inside
  // `/admin`, so the counts refresh with `router.refresh()`. An unreadable count is "—", never 0.
  const queue = await fetchAdminActionQueue();

  return (
    <AdminShell adminEmail={admin.email} queue={queue}>
      {/*
        Hydrates the client auth store for the whole admin section. This used to live on the
        dashboard page alone, which left every other admin page rendering with an empty user
        store — anything reading `useUserStore` from an inner page saw null until the operator
        happened to visit `/admin` first.
      */}
      <AuthInitializer initialUser={admin} />

      {/* Chart gradients, declared once here so no chart needs `useId` to own one. */}
      <ChartDefs />

      {children}
    </AdminShell>
  );
};

export default AdminLayout;
