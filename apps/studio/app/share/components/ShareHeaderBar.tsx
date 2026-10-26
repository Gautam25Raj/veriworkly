import Link from "next/link";
import { Sparkles, CalendarDays, LayoutDashboard } from "lucide-react";

import { useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";

import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

import { authClient } from "@/lib/auth-client";

interface ShareHeaderBarProps {
  title?: string;
  expiresAt: string | null;
  actions?: ReactNode;
}

const subscribeNever = () => () => {};

/**
 * The reader's own date format exists only in the browser, so the server renders the UTC
 * calendar date and the client swaps in the local one without a hydration mismatch.
 */
function LocalDate({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribeNever,
    () => new Date(iso).toLocaleDateString(),
    () => new Date(iso).toISOString().slice(0, 10),
  );

  return <time dateTime={iso}>{text}</time>;
}

export const ShareHeaderBar = ({ title, expiresAt, actions }: ShareHeaderBarProps) => {
  const { data: session } = authClient.useSession();

  return (
    <header className="sticky top-0 z-50 mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:pt-6">
      <div className="border-border bg-card/80 relative overflow-visible rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-md md:rounded-full md:px-8 lg:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-foreground truncate text-xl font-bold tracking-tight md:text-2xl">
              {title || "Shared Document"}
            </h1>

            {expiresAt ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                <CalendarDays className="h-3.5 w-3.5" />
                Available until <LocalDate iso={expiresAt} />
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {actions}

            <div className="flex items-center gap-2">
              {session ? (
                <Button
                  asChild
                  size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 h-10 rounded-full px-5 text-[12px] font-bold tracking-wide"
                >
                  <Link href="/">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-10 rounded-full px-5 text-[12px] font-bold tracking-wide"
                >
                  <a href={siteConfig.links.main}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Build Yours
                  </a>
                </Button>
              )}

              <ThemeToggle className="border-border hover:bg-foreground/5 h-10 w-10 rounded-full border px-0 dark:border-zinc-800" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
