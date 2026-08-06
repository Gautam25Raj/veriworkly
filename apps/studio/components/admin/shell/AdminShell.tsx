"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import AdminCommandPalette from "@/components/admin/shell/AdminCommandPalette";
import AdminSidebar from "@/components/admin/shell/AdminSidebar";
import AdminTopbar from "@/components/admin/shell/AdminTopbar";
import type { AdminActionQueue } from "@/features/admin/types/admin-types";

interface AdminShellProps {
  adminEmail: string;
  queue: AdminActionQueue;
  children: ReactNode;
}

/**
 * The admin chrome: fixed sidebar, sticky topbar, scrolling content well.
 *
 * This is the only client component in the shell — the sidebar and topbar need the current
 * pathname and the drawer/palette need state, but everything rendered into `children` stays a
 * server component. That boundary matters: the pages inside are data-heavy server renders and
 * must not be pulled into the client bundle just because their chrome is interactive.
 */
const AdminShell = ({ adminEmail, queue, children }: AdminShellProps) => {
  const pathname = usePathname();

  const [paletteOpen, setPaletteOpen] = useState(false);

  /**
   * The drawer records which route it was opened on, and is treated as closed once the route
   * changes. A drawer left open across a navigation would cover the page the operator just
   * asked for, but closing it from an effect on `pathname` means rendering the open drawer
   * once and then immediately re-rendering to hide it. Deriving it here closes the drawer in
   * the same render as the navigation, with no intermediate frame.
   */
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const drawerOpen = drawer.open && drawer.path === pathname;

  const openDrawer = () => setDrawer({ open: true, path: pathname });
  const closeDrawer = () => setDrawer({ open: false, path: pathname });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        // Chrome binds Ctrl+K to the address bar; without this the palette never opens on
        // Windows and Linux.
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="bg-background min-h-screen">
      {/* Desktop rail. Fixed rather than sticky so a long table scrolls under a still nav. */}
      <aside className="border-border bg-admin-chrome fixed inset-y-0 left-0 z-40 hidden w-60 border-r lg:block">
        <AdminSidebar queue={queue} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="bg-foreground/25 absolute inset-0 cursor-default backdrop-blur-[2px]"
            onClick={() => closeDrawer()}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="border-border bg-admin-chrome absolute inset-y-0 left-0 w-72 border-r shadow-2xl"
          >
            <button
              type="button"
              onClick={() => closeDrawer()}
              aria-label="Close navigation"
              className="text-muted hover:text-foreground focus-visible:ring-accent absolute top-3.5 right-3 z-10 rounded-lg p-1.5 transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>

            <AdminSidebar queue={queue} onNavigate={() => closeDrawer()} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-60">
        <AdminTopbar
          adminEmail={adminEmail}
          onOpenSidebar={() => openDrawer()}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="mx-auto w-full max-w-368 flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>

      {/*
        Mounted only while open, so every opening starts from a fresh query and highlight
        without an effect that resets them.
      */}
      {paletteOpen ? <AdminCommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
};

export default AdminShell;
