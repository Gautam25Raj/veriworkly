"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu, RefreshCw, Search } from "lucide-react";

import { cn } from "@veriworkly/ui";

import { fetchApiData } from "@/utils/fetchApiData";
import { buildAdminBreadcrumbs } from "@/features/admin/config/admin-nav";

interface AdminTopbarProps {
  adminEmail: string;
  onOpenSidebar: () => void;
  onOpenPalette: () => void;
}

const AdminTopbar = ({ adminEmail, onOpenSidebar, onOpenPalette }: AdminTopbarProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const [isRefreshing, startRefresh] = useTransition();
  const [isSigningOut, setSigningOut] = useState(false);

  const crumbs = buildAdminBreadcrumbs(pathname);

  const signOut = async () => {
    setSigningOut(true);

    try {
      await fetchApiData("/auth/sign-out", { method: "POST" });
      router.push("/");
    } catch {
      // Leaving the button enabled is the useful failure mode here — the operator can retry,
      // and there is nowhere on a chrome bar to surface an error without displacing the nav.
      setSigningOut(false);
    }
  };

  return (
    // The topbar shares the rail's surface rather than the card's. As `bg-card/85` it was white
    // where the rail was warm, so the two halves of the chrome met in an L-shaped seam at the
    // top-left corner and the bar read as content rather than as frame.
    <header className="border-border bg-admin-chrome/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-5">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="text-muted hover:bg-admin-inset hover:text-foreground focus-visible:ring-accent -ml-1 rounded-lg p-2 transition focus-visible:ring-2 focus-visible:outline-none lg:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;

            return (
              <Fragment key={crumb.href}>
                {index > 0 ? (
                  <ChevronRight
                    className="text-muted h-3.5 w-3.5 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                ) : null}

                <li className={cn("min-w-0", last ? "" : "hidden sm:block")}>
                  {last ? (
                    <span aria-current="page" className="text-foreground truncate font-medium">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-muted hover:text-foreground truncate transition"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenPalette}
        className="border-border text-muted hover:border-accent/40 hover:text-foreground focus-visible:ring-accent flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:outline-none"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="border-border hidden rounded border px-1 py-px text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      {/*
        Server components cache their fetches per request, so a plain re-render would show the
        same numbers. `router.refresh()` re-runs them on the server and streams new markup in,
        which is what an operator means by "refresh" on a dashboard.
      */}
      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        aria-label="Refresh data"
        disabled={isRefreshing}
        className="text-muted hover:bg-admin-inset hover:text-foreground focus-visible:ring-accent rounded-lg p-2 transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      </button>

      <span className="text-muted hidden max-w-40 truncate text-xs lg:block" title={adminEmail}>
        {adminEmail}
      </span>

      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sign out"
        disabled={isSigningOut}
        className="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-accent rounded-lg p-2 transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
};

export default AdminTopbar;
