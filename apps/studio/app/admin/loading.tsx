"use client";

import { usePathname } from "next/navigation";

import AdminSkeleton from "@/components/admin/AdminSkeleton";
import { resolveAdminRoute } from "@/features/admin/config/admin-routes";

/**
 * The one admin loading UI; the skeleton matching the destination page is chosen from the URL.
 *
 * A `loading.tsx` wraps each child segment of its own folder, so this file covers the routes one
 * level under `/admin`. Folders with nested routes (`affiliates`, `ambassadors`, `billing`,
 * `portfolios`, `roadmap`, `users`) re-export it so a navigation between their own pages gets a
 * fresh boundary and shows the skeleton too.
 */
export default function AdminLoading() {
  return <AdminSkeleton skeleton={resolveAdminRoute(usePathname()).skeleton} />;
}
