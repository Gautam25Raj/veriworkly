"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Coins,
  CreditCard,
  LogIn,
  LogOut,
  User,
  UserRound,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import type { DocumentMeta } from "@/features/documents/core/types";

import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { downloadWorkspaceBackup, signOutCurrentUser } from "@/features/auth/services/current-user";
import {
  flushPendingSaves,
  listDocuments,
} from "@/features/documents/services/document-workspace-service";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

import AccountMenuItem from "./AccountMenuItem";
import AccountMenuTheme from "./AccountMenuTheme";

interface AccountMenuProps {
  collapsed: boolean;
  displayName: string;
  email: string;
  version: string;
}

export function AccountMenu({ collapsed, displayName, email, version }: AccountMenuProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { isLoggedIn } = useUserStore();

  const [unsyncedDocuments, setUnsyncedDocuments] = useState<DocumentMeta[] | null>(null);
  const [backupFailure, setBackupFailure] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const [prevPathname, setPrevPathname] = useState(pathname);

  // Dismiss the menu whenever navigation occurs
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Handle outside clicks and Escape key
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const navigateAndClose = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const signOut = async () => {
    setSigningOut(true);

    try {
      await signOutCurrentUser();
      setUnsyncedDocuments(null);
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  // Signing out deletes this device's copies, so anything the cloud does not hold yet is
  // offered as a download first.
  const handleLogout = () => {
    setOpen(false);
    flushPendingSaves();

    const unsynced = listDocuments().filter((item) => item.sync.status !== "synced");

    if (unsynced.length === 0) {
      void signOut();
      return;
    }

    setBackupFailure(null);
    setUnsyncedDocuments(unsynced);
  };
  const downloadThenSignOut = async () => {
    if (!unsyncedDocuments) return;

    if (backupFailure === null) {
      try {
        downloadWorkspaceBackup(unsyncedDocuments);
      } catch (error) {
        setBackupFailure(error instanceof Error ? error.message : "The download failed.");
        return;
      }
    }

    await signOut();
  };

  return (
    <div className="relative" ref={rootRef}>
      {open ? (
        <div
          className="border-border bg-card absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border p-2 shadow-2xl ring-1 ring-black/5"
          role="menu"
          aria-label="Account options"
        >
          <div className="border-border/70 flex items-center gap-3 border-b px-2 py-2.5">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                isLoggedIn ? "bg-accent/10 text-accent" : "bg-muted/30 text-muted",
              )}
            >
              {isLoggedIn ? (
                displayName.slice(0, 1).toUpperCase()
              ) : (
                <UserRound className="h-5 w-5" />
              )}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{displayName}</span>
              <span className="text-muted block truncate text-xs">{email}</span>
            </span>
          </div>

          {isLoggedIn ? (
            <>
              <AccountMenuItem
                icon={User}
                label="Profile"
                onClick={() => navigateAndClose("/profile")}
              />

              <AccountMenuItem
                icon={CreditCard}
                label="Billing"
                onClick={() => navigateAndClose("/billing")}
              />

              <AccountMenuItem
                icon={Coins}
                label="AI credits"
                onClick={() => navigateAndClose("/credits")}
              />
            </>
          ) : null}

          <AccountMenuItem
            icon={Settings}
            label="Settings"
            onClick={() => navigateAndClose("/settings")}
          />

          <AccountMenuTheme setOpen={setOpen} />

          {isLoggedIn ? (
            <AccountMenuItem danger icon={LogOut} label="Logout" onClick={handleLogout} />
          ) : (
            <AccountMenuItem
              icon={LogIn}
              label="Log In"
              onClick={() => navigateAndClose("/login")}
            />
          )}

          <div className="text-muted border-border/70 mt-1 border-t px-3 pt-2 text-[11px]">
            {version} -{" "}
            <a
              href={`${siteConfig.links.main}/terms`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              Terms
            </a>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "border-border bg-card hover:bg-background flex w-full items-center gap-2 rounded-lg border p-2 text-left shadow-sm transition",
          collapsed && "justify-center p-1.5",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            isLoggedIn ? "bg-accent/10 text-accent" : "bg-muted/30 text-muted",
          )}
        >
          {isLoggedIn ? displayName.slice(0, 1).toUpperCase() : <UserRound className="h-4 w-4" />}
        </span>

        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{displayName}</span>
              <span className="text-muted block truncate text-[11px]">{email}</span>
            </span>

            <ChevronDown className="text-muted h-4 w-4" />
          </>
        ) : null}
      </button>

      <ConfirmationModal
        open={unsyncedDocuments !== null}
        onClose={() => {
          if (!signingOut) setUnsyncedDocuments(null);
        }}
        onConfirm={() => void downloadThenSignOut()}
        loading={signingOut}
        variant="warning"
        title={backupFailure === null ? "Back up before signing out?" : "Download failed"}
        description={
          backupFailure === null
            ? `${unsyncedDocuments?.length ?? 0} document(s) on this device have changes that are not in the cloud. Signing out removes them from this device, so they will be downloaded as one JSON backup file first.`
            : `${backupFailure} Signing out now permanently removes the unsynced documents from this device.`
        }
        confirmText={backupFailure === null ? "Download and sign out" : "Sign out anyway"}
      />
    </div>
  );
}
