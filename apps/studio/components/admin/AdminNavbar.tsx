"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@veriworkly/ui";

/**
 * Ordered by how often an operator needs each surface, not alphabetically: the moderation and
 * money queues come before the read-only ops pages.
 */
const NAV_GROUPS: Array<{ label: string; items: Array<{ href: string; label: string }> }> = [
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/ambassadors", label: "Ambassadors" },
      { href: "/admin/affiliates", label: "Affiliates" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/portfolios", label: "Portfolios" },
      { href: "/admin/documents", label: "Documents" },
      { href: "/admin/share-links", label: "Share links" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/billing", label: "Billing" },
      { href: "/admin/billing/webhooks", label: "Webhooks" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/roadmap", label: "Roadmap" },
      { href: "/admin/api-keys", label: "API keys" },
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/system", label: "System" },
    ],
  },
];

const FLAT_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/**
 * `/admin` is only "active" on an exact match — every other route is a prefix match so that
 * `/admin/users/abc123` still highlights Users.
 */
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const AdminNavbar = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (href: string) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium transition whitespace-nowrap",
      isActive(pathname, href)
        ? "bg-accent text-accent-foreground"
        : "text-muted hover:text-foreground hover:bg-background",
    );

  return (
    <header className="border-border/70 bg-card/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="group">
            <p className="text-muted text-xs font-medium tracking-[0.18em] uppercase">VeriWorkly</p>
            <p className="text-foreground text-lg font-semibold">Admin Workspace</p>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/admin" className={linkClass("/admin")}>
              Overview
            </Link>

            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="admin-nav-links"
              className="text-muted hover:text-foreground hover:bg-background cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>

            <Link
              href="/"
              className="text-muted hover:text-foreground hover:bg-background hidden rounded-full px-3 py-1.5 text-sm font-medium transition lg:inline-flex"
            >
              Exit admin
            </Link>
          </div>
        </div>

        <nav
          id="admin-nav-links"
          className={cn(
            "mt-3 flex-wrap items-center gap-x-1 gap-y-2 lg:flex",
            mobileOpen ? "flex" : "hidden",
          )}
        >
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1">
              {index > 0 ? <span className="bg-border mx-2 hidden h-4 w-px lg:block" /> : null}

              <span className="text-muted mr-1 hidden text-[0.65rem] font-semibold tracking-wider uppercase lg:inline">
                {group.label}
              </span>

              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(item.href)}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
};

export { FLAT_ITEMS as ADMIN_NAV_ITEMS };
export default AdminNavbar;
