import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { getBillingServerData } from "@/features/billing/billing-server";
import { AmbassadorPage } from "@/features/ambassador/AmbassadorPage";
import type { AmbassadorStatus } from "@/features/ambassador/types";

export const metadata: Metadata = { title: "Ambassador", robots: { index: false, follow: false } };

export default async function AmbassadorRoute() {
  const status = await getBillingServerData<AmbassadorStatus>("/ambassador/me");
  const isAmbassador = status?.role === "AMBASSADOR";
  const isPending = status?.ambassadorStatus === "PENDING";

  if (!isAmbassador && !isPending) redirect(`${siteConfig.links.main}/ambassador`);

  return <AmbassadorPage status={status} />;
}
