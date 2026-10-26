import { AffiliateNav } from "@/features/affiliate/AffiliateNav";
import { AffiliatePayoutForm } from "@/features/affiliate/AffiliatePayoutForm";
import type { AffiliateDashboard } from "@/features/affiliate/types";
import { getProgramServerData, PROGRAM_UNAVAILABLE } from "@/features/billing/billing-server";
import { ProgramUnavailable } from "@/features/billing/ProgramUnavailable";
const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
export default async function AffiliatePayoutsPage() {
  const data = await getProgramServerData<AffiliateDashboard>("/affiliates/me");
  if (data === PROGRAM_UNAVAILABLE) return <ProgramUnavailable program="affiliate" />;
  return (
    <main className="space-y-5">
      <AffiliateNav />
      <header className="border-border bg-card rounded-2xl border p-5">
        <h1 className="text-3xl font-black">Payouts</h1>
        <p className="text-muted mt-2 text-sm">
          Only released commission balance can be withdrawn.
        </p>
      </header>
      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <article className="border-border bg-card rounded-2xl border p-5">
          <p className="text-muted text-xs font-bold">Available</p>
          <p className="mt-2 text-3xl font-black">{money(data?.wallet.availableCents ?? 0)}</p>
          <p className="text-muted mt-2 text-xs">
            Minimum payout {money(data?.minimumWithdrawalCents ?? 2500)}
          </p>
          <div className="mt-5">
            <AffiliatePayoutForm
              availableCents={data?.wallet.availableCents ?? 0}
              minimumCents={data?.minimumWithdrawalCents ?? 2500}
            />
          </div>
        </article>
        <article className="border-border bg-card rounded-2xl border p-5">
          <h2 className="font-black">Payout history</h2>
          <div className="mt-4 divide-y">
            {data?.withdrawals.length ? (
              data.withdrawals.map((item) => (
                <div className="flex justify-between gap-4 py-4 text-sm" key={item.id}>
                  <div>
                    <p className="font-bold">{item.status}</p>
                    <p className="text-muted text-xs">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    {item.payoutNote ? (
                      <p className="text-muted mt-1 text-xs">Note: {item.payoutNote}</p>
                    ) : null}
                  </div>
                  <strong>{money(item.amountCents, item.currency)}</strong>
                </div>
              ))
            ) : (
              <p className="text-muted py-5 text-sm">No payout requests yet.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
