import type { Metadata } from "next";
import { getProgramServerData, PROGRAM_UNAVAILABLE } from "@/features/billing/billing-server";
import { ProgramUnavailable } from "@/features/billing/ProgramUnavailable";
import { AffiliatePage } from "@/features/affiliate/AffiliatePage";
import type { AffiliateDashboard } from "@/features/affiliate/types";

export const metadata: Metadata = { title: "Affiliate", robots: { index: false, follow: false } };
export default async function AffiliateRoute() {
  const dashboard = await getProgramServerData<AffiliateDashboard>("/affiliates/me");
  if (dashboard === PROGRAM_UNAVAILABLE) return <ProgramUnavailable program="affiliate" />;
  return <AffiliatePage dashboard={dashboard} />;
}
