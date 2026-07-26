import type { ReactNode } from "react";
import type { Metadata } from "next";

import AdminNavbar from "@/components/admin/AdminNavbar";
import { requireAdminUser } from "@/features/admin/services/admin-server";

export const metadata: Metadata = {
  title: "Admin",
  description: "VeriWorkly admin operations and roadmap management.",
  robots: { index: false, follow: false },
};

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  // Fails closed (404) for any non-admin session before rendering anything below —
  // the backend independently re-enforces this on every admin API call, but the
  // frontend must not rely on that alone (see requireAdminUser's doc comment).
  await requireAdminUser();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(180,216,200,0.20),transparent_50%),linear-gradient(180deg,rgba(10,14,18,0.02)_0%,rgba(10,14,18,0)_45%)]">
      <AdminNavbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">{children}</main>
    </div>
  );
};

export default AdminLayout;
