"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarClock,
  Coins,
  ExternalLink,
  FileClock,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";
import { useUserStore } from "@/store/useUserStore";
import { buyCreditPack, openBillingPortal, cancelCheckout } from "@/features/billing/billing-api";
import type { BillingActivity, BillingSummary } from "@/features/billing/types";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "@/utils/fetchApiData";

const CHECKOUT_LOCK_CONFLICT_STATUS = 409;

const planNames = {
  FREE: "Free",
  AI_CREDITS: "AI Credits",
  PORTFOLIO_PRO: "Creator Pro",
  BUNDLE: "Job Hunter Bundle",
} as const;

function displayDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not scheduled";
}

export function BillingPage({
  billing,
  history,
}: {
  billing: BillingSummary | null;
  history: BillingActivity[];
}) {
  const [loading, setLoading] = useState("");
  const [error, setError] = useState<{ message: string; isCheckoutLockConflict: boolean } | null>(
    null,
  );
  const [clearingLock, setClearingLock] = useState(false);
  const [finalizingPurchase, setFinalizingPurchase] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const { user } = useUserStore();

  // Whether payments are actually blocked for this user is decided authoritatively by
  // the backend (BillingController.assertPaymentsEnabled), which returns a clear 403
  // message that surfaces via the `error` state below. We deliberately do not try to
  // replicate that admin check on the client — doing so would require shipping an
  // admin identity into the public bundle and would only ever be an unreliable guess.

  const creditPack250 = billing?.creditEconomics.packs.find(
    (pack) => pack.key === "credit_pack_250",
  );
  const creditPack500 = billing?.creditEconomics.packs.find(
    (pack) => pack.key === "credit_pack_500",
  );

  useEffect(() => {
    const checkoutStatus = searchParams?.get("checkout");

    if (checkoutStatus === "cancelled") {
      void cancelCheckout()
        .then(() => {
          router.replace("/billing");
        })
        .catch((err) => {
          console.error("Failed to cancel checkout lock", err);
        });
      return;
    }

    if (checkoutStatus === "success") {
      // Plan/credit updates are driven by an async webhook, so the freshly
      // loaded server data may still be stale for a moment. Re-fetch a few
      // times with backoff and surface a "finalizing" state instead of
      // silently showing outdated numbers.
      // Deferred to a microtask so this setState call doesn't run synchronously
      // inside the effect body itself (cascading-render lint rule).
      queueMicrotask(() => setFinalizingPurchase(true));
      router.replace("/billing");

      const delays = [1500, 2500, 4000];
      const timers = delays.map((delay) => window.setTimeout(() => router.refresh(), delay));
      const finalTimer = window.setTimeout(
        () => setFinalizingPurchase(false),
        delays[delays.length - 1] + 500,
      );

      return () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        window.clearTimeout(finalTimer);
        setFinalizingPurchase(false);
      };
    }
  }, [searchParams, router]);

  const toBillingError = (cause: unknown, fallbackMessage: string) => ({
    message: cause instanceof Error ? cause.message : fallbackMessage,
    isCheckoutLockConflict:
      cause instanceof ApiRequestError && cause.status === CHECKOUT_LOCK_CONFLICT_STATUS,
  });

  const handleClearLock = async () => {
    setClearingLock(true);
    try {
      await cancelCheckout();
      setError(null);
    } catch (cause) {
      setError(toBillingError(cause, "Could not clear checkout lock."));
    } finally {
      setClearingLock(false);
    }
  };

  const openPortal = async () => {
    setLoading("portal");
    setError(null);
    try {
      window.location.assign((await openBillingPortal()).url);
    } catch (cause) {
      setError(toBillingError(cause, "Could not open billing portal."));
      setLoading("");
    }
  };

  const buyPack = async (packKey: "credit_pack_250" | "credit_pack_500") => {
    setLoading(packKey);
    setError(null);
    try {
      window.location.assign((await buyCreditPack(packKey)).url);
    } catch (cause) {
      setError(toBillingError(cause, "Could not start credit checkout."));
      setLoading("");
    }
  };

  return (
    <main className="relative min-h-[400px]">
      <div className={cn("space-y-5", !user && "pointer-events-none opacity-40 blur-[3px]")}>
        <header className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Billing and plan</h1>
              <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
                Manage the plan already attached to your account, renewal details, credits, and
                invoices.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {billing?.productKey ? (
                <Button
                  variant="secondary"
                  loading={loading === "portal"}
                  onClick={() => void openPortal()}
                >
                  Manage subscription <ExternalLink className="mr-2 h-4 w-4" />
                </Button>
              ) : (
                <Button asChild disabled={!user}>
                  <Link href={user ? `${siteConfig.links.main}/pricing` : "#"}>
                    View upgrade options
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        {finalizingPurchase ? (
          <div className="border-accent/30 bg-accent-soft text-accent flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
            <span className="border-accent/40 border-t-accent h-4 w-4 animate-spin rounded-full border-2" />
            Finalizing your purchase — this can take a few seconds while we confirm payment.
          </div>
        ) : null}

        {error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 text-sm">
            <p className="flex-1">{error.message}</p>
            {error.isCheckoutLockConflict && (
              <Button
                size="sm"
                variant="secondary"
                loading={clearingLock}
                onClick={() => void handleClearLock()}
              >
                Reset checkout lock
              </Button>
            )}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
          <article className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-center gap-2 text-sm font-black">
              <ShieldCheck className="text-accent h-4 w-4" /> Current plan
            </div>
            <p className="mt-5 text-3xl font-black">
              {billing ? planNames[billing.plan] : "Unavailable"}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail
                icon={CalendarClock}
                label={billing?.cancelAtPeriodEnd ? "Access ends" : "Next renewal"}
                value={displayDate(billing?.currentPeriodEnd ?? null)}
              />
              <Detail
                icon={ShieldCheck}
                label="Subscription status"
                value={billing?.status.replaceAll("_", " ") ?? "Unavailable"}
              />
            </div>
            <div className="border-border mt-5 border-t pt-5">
              <p className="text-muted text-xs font-bold">Included account access</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(billing?.entitlements ?? []).map((item) => (
                  <span
                    className="bg-background border-border rounded-lg border px-2.5 py-1.5 text-xs font-bold uppercase"
                    key={item}
                  >
                    {item.replaceAll("_", " ")}
                  </span>
                ))}

                {!billing?.entitlements.length ? (
                  <span className="text-muted text-sm">Free account access</span>
                ) : null}
              </div>
            </div>
          </article>

          <article className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-center gap-2 text-sm font-black">
              <Coins className="text-accent h-4 w-4" /> AI credits
            </div>
            <p className="mt-5 text-4xl font-black">{billing?.credits.balance ?? 0}</p>
            <p className="text-muted mt-1 text-sm">credits available</p>
            <div className="border-border mt-5 border-t pt-4">
              <p className="text-sm font-bold">
                {billing?.credits.nextExpiryCredits
                  ? `${billing.credits.nextExpiryCredits} credits expire ${displayDate(billing.credits.nextExpiryAt)}`
                  : "No credits currently scheduled to expire"}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                loading={loading === "credit_pack_250"}
                disabled={!creditPack250?.configured || !user}
                onClick={() => void buyPack("credit_pack_250")}
              >
                {creditPack250?.configured ? "Buy 250 credits" : "Coming soon"}
              </Button>
              <Button
                loading={loading === "credit_pack_500"}
                disabled={!creditPack500?.configured || !user}
                onClick={() => void buyPack("credit_pack_500")}
              >
                {creditPack500?.configured ? "Buy 500 credits" : "Coming soon"}
              </Button>
            </div>
            <Link
              className="text-accent mt-3 block text-center text-xs font-bold"
              href={user ? "/credits" : "#"}
            >
              View usage and action costs
            </Link>
          </article>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5">
          <h2 className="flex items-center gap-2 font-black">
            <FileClock className="h-4 w-4" /> Billing history
          </h2>
          <div className="border-border mt-4 divide-y border-y">
            {history.length ? (
              history.map((item) => (
                <div className="flex items-center justify-between gap-4 py-3 text-sm" key={item.id}>
                  <span className="font-semibold">
                    {item.type
                      .replace("subscription.", "Subscription ")
                      .replace("payment.", "Payment ")
                      .replaceAll("_", " ")}
                  </span>
                  <time className="text-muted">
                    {new Date(item.processedAt ?? item.createdAt).toLocaleDateString()}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-muted py-5 text-sm">No billing activity yet.</p>
            )}
          </div>
        </section>
      </div>

      {!user ? (
        <div className="border-border bg-card/45 absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border p-6 text-center backdrop-blur-sm">
          <div className="bg-accent-soft text-accent flex h-12 w-12 items-center justify-center rounded-full">
            <LockKeyhole size={20} />
          </div>
          <h2 className="text-foreground mt-4 text-base font-extrabold">
            Log in to view subscriptions
          </h2>
          <p className="text-muted-foreground mt-1.5 max-w-sm text-xs leading-5">
            Please log in or create an account to view subscription plans, purchase credits, and
            manage billing history.
          </p>
          <button
            onClick={() => {
              const loginUrl = `${siteConfig.links.app}/login`;
              window.location.href = `${loginUrl}?callbackURL=${encodeURIComponent(window.location.href)}`;
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90 mt-5 inline-flex min-h-10 items-center justify-center rounded-lg px-5 text-xs font-bold transition"
          >
            Log In
          </button>
        </div>
      ) : null}
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-background rounded-xl p-4">
      <Icon className="text-accent h-4 w-4" />
      <p className="text-muted mt-3 text-xs font-bold">{label}</p>
      <p className="mt-1 text-sm font-black capitalize">{value}</p>
    </div>
  );
}
