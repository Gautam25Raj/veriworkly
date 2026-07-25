import Link from "next/link";
import { Hourglass, Trophy } from "lucide-react";
import { siteConfig } from "@/config/site";

export function AmbassadorAlreadyAcceptedCard() {
  return (
    <div className="glass-card mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-zinc-200/60 px-8 py-16 text-center shadow-2xl dark:border-white/10">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Trophy className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
        You&apos;re already a Campus Ambassador
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        No need to re-apply — your dashboard, perks, and referral tools are waiting for you in
        studio.
      </p>
      <Link
        href={`${siteConfig.links.app}/ambassador`}
        className="mt-8 inline-flex items-center justify-center rounded-full border border-zinc-950/10 bg-zinc-950 px-8 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] dark:border-white/20 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        Go to my dashboard
      </Link>
    </div>
  );
}

export function AmbassadorPendingCard() {
  return (
    <div className="glass-card mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-zinc-200/60 px-8 py-16 text-center shadow-2xl dark:border-white/10">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Hourglass className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
        Your application is already in review
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        We&apos;ve got it, we&apos;re reading it, we&apos;re probably smiling about it. Check back
        soon — decisions land in your inbox.
      </p>
      <Link
        href="/ambassador"
        className="mt-8 inline-flex items-center justify-center rounded-full border border-zinc-200 px-8 py-3.5 text-xs font-black tracking-wider text-zinc-700 uppercase transition-all hover:border-indigo-500/40 active:scale-[0.98] dark:border-white/15 dark:text-zinc-300"
      >
        Back to program page
      </Link>
    </div>
  );
}
