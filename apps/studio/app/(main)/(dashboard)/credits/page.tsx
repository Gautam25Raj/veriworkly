import type { Metadata } from "next";

import { getBillingServerData } from "@/features/billing/billing-server";
import { CreditUsagePage } from "@/features/credits/CreditUsagePage";
import type { CreditTransaction, CreditWallet } from "@/features/credits/types";
import type { BillingSummary } from "@/features/billing/types";
import type { AtsQuota } from "@/features/ats/types";

export const metadata: Metadata = {
  title: "Credit usage",
  robots: { index: false, follow: false },
};

export default async function CreditsPage() {
  const [wallet, history, billing, atsQuota] = await Promise.all([
    getBillingServerData<CreditWallet>("/billing/credits"),
    getBillingServerData<CreditTransaction[]>("/billing/credits/history"),
    getBillingServerData<BillingSummary>("/billing/me"),
    // ATS prices are a side panel here: when they cannot be read the page says so in place of
    // the ATS rows rather than failing the whole credits page.
    getBillingServerData<AtsQuota>("/ats/quota").catch(() => null),
  ]);
  return (
    <CreditUsagePage
      wallet={wallet}
      history={history ?? []}
      economics={billing?.creditEconomics ?? null}
      atsPricing={atsQuota?.pricing ?? null}
    />
  );
}
