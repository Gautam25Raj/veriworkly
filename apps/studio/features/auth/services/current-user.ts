import { backendApiUrl } from "@/lib/constants";
import { clearInvalidSessionAndRedirect, isInvalidSessionResponse } from "@/lib/invalid-session";

import type {
  BaseDocument,
  DocumentMeta,
  DocumentSyncState,
} from "@/features/documents/core/types";

import { withDocumentIdentity } from "@/features/documents/core/content-identity";

import { downloadBlob } from "@/features/documents/export/download";
import {
  clearWorkspaceStorage,
  loadDocumentById,
} from "@/features/documents/services/document-workspace-service";
import {
  WORKSPACE_BACKUP_FORMAT,
  type WorkspaceBackup,
} from "@/features/documents/services/import-service";
import { useUserStore } from "@/store/useUserStore";

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  username?: string;
  image?: string | null;
  createdAt?: string;
  emailVerified?: boolean;
  autoSyncEnabled?: boolean;
  shareResumeCount?: number;
};

type AccountProfileResponse = {
  data?: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    createdAt?: string;
    emailVerified?: boolean;
    autoSyncEnabled?: boolean;
    _count?: {
      shareLinks?: number;
    };
  };
};

let memoryCache: SessionUser | null = null;

async function fetchAccountProfileSummary(cookieHeader?: string) {
  try {
    if (
      typeof window === "undefined" &&
      cookieHeader !== undefined &&
      !cookieHeader.includes("veriworkly-auth")
    )
      return null;

    const response = await fetch(backendApiUrl("/users/me"), {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      credentials: cookieHeader ? undefined : "include",
    });

    if (!response.ok) {
      if (typeof window !== "undefined" && isInvalidSessionResponse("/users/me", response.status))
        await clearInvalidSessionAndRedirect();

      return null;
    }

    const payload = (await response.json()) as AccountProfileResponse;
    const user = payload.data;

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      username: user.username ?? undefined,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      autoSyncEnabled: user.autoSyncEnabled,
      shareResumeCount: user._count?.shareLinks,
    } satisfies Partial<SessionUser>;
  } catch {
    return null;
  }
}

export async function fetchCurrentUser(force = false): Promise<SessionUser | null> {
  const isServer = typeof window === "undefined";

  if (isServer) {
    try {
      const { cookies } = await import("next/headers");

      const cookieStore = await cookies();
      const cookieHeader = cookieStore.toString();
      const summary = await fetchAccountProfileSummary(cookieHeader);

      if (!summary?.id || !summary?.email) return null;

      return summary as SessionUser;
    } catch {
      return null;
    }
  }

  if (!force && memoryCache) return memoryCache;

  try {
    const summary = await fetchAccountProfileSummary();
    if (!summary?.id || !summary?.email) {
      memoryCache = null;
      return null;
    }

    memoryCache = summary as SessionUser;

    return memoryCache;
  } catch {
    return null;
  }
}

const DETACHED_SYNC: DocumentSyncState = {
  enabled: false,
  status: "local-only",
  cloudDocumentId: null,
  lastSyncedAt: null,
  revision: 1,
};

/**
 * Every listed document as one restorable file: the toolbar's "Import JSON" reads it back,
 * one new document per entry.
 *
 * One file, not one per document: browsers block the second automatic download, and the
 * caller deletes the local copies right after. Cloud linkage is dropped so a restored copy
 * is a new local document, never a second writer to the original. A body that cannot be
 * read throws, so the caller never clears a device whose backup is incomplete.
 */
export function buildWorkspaceBackup(documents: DocumentMeta[], now = new Date()) {
  const stored = documents.map((meta) => loadDocumentById(meta.type, meta.id));
  const unreadable = stored.filter((document) => document === null).length;

  if (unreadable > 0) {
    throw new Error(`${unreadable} document(s) could not be read, so no backup was made.`);
  }

  const backup: WorkspaceBackup = {
    format: WORKSPACE_BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    documents: (stored as BaseDocument[]).map((document) => ({
      ...document,
      sync: DETACHED_SYNC,
      content: withDocumentIdentity(document.content, { id: document.id, sync: DETACHED_SYNC }),
    })),
  };

  return {
    fileName: `veriworkly-backup-${now.toISOString().slice(0, 10)}.json`,
    json: JSON.stringify(backup, null, 2),
  };
}

export function downloadWorkspaceBackup(documents: DocumentMeta[]) {
  const { fileName, json } = buildWorkspaceBackup(documents);

  downloadBlob(new Blob([json], { type: "application/json" }), fileName);
}

const GUEST_MODE_COOKIE = "veriworkly-guest-mode";

/** Expired on every domain the login page sets it on: this host and the shared parent. */
function expireGuestModeCookie() {
  const expired = `${GUEST_MODE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  const { hostname } = window.location;

  document.cookie = expired;

  if (hostname.endsWith("veriworkly.com")) {
    document.cookie = `${expired}; domain=.veriworkly.com`;
  } else if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    document.cookie = `${expired}; domain=.localhost`;
  }
}

/**
 * Forgets the account on this device: documents, sync outbox, master-profile cache, the
 * guest flag and the signed-in user. Without it the next person to sign in on a shared
 * device inherits the previous user's documents, and auto-sync pushes them into their
 * account.
 */
export function clearLocalAccountData() {
  memoryCache = null;
  clearWorkspaceStorage();
  expireGuestModeCookie();
  useUserStore.getState().logout();
}

/**
 * Ends the server session, then clears local data. Throws while the session cookie is
 * still valid, so the UI never shows a signed-out state the server does not share.
 */
export async function signOutCurrentUser() {
  const response = await fetch(backendApiUrl("/auth/sign-out"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });

  // 401: the session had already ended, which is the state signing out asks for.
  if (!response.ok && response.status !== 401) {
    throw new Error(`Sign-out failed (${response.status}). You are still signed in.`);
  }

  clearLocalAccountData();
}
