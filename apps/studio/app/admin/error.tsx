"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@veriworkly/ui";

import { resolveAdminRoute } from "@/features/admin/config/admin-routes";

/**
 * The one error boundary for every admin page; the failing surface is named from the URL.
 *
 * `fetchAdmin` throws rather than returning a partial shape, because an ops dashboard silently
 * rendering zeros is worse than one showing an error. In production a Server Component error
 * reaches the client as a generic message plus a digest, and the digest is what matches the
 * server log. The admin layout's own gate (`requireAdminUser`) is above this boundary; its
 * failures reach the root `app/error.tsx`.
 */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const { surface } = resolveAdminRoute(usePathname());

  const message = error instanceof Error ? error.message : "";
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <div className="flex min-h-[50vh] items-center justify-center py-10">
      <div className="border-destructive/25 bg-destructive/5 w-full max-w-lg rounded-xl border p-6 text-center">
        <div className="bg-destructive/10 mx-auto flex h-10 w-10 items-center justify-center rounded-full">
          <AlertTriangle className="text-destructive h-5 w-5" aria-hidden="true" />
        </div>

        <h2 className="text-foreground mt-4 text-base font-semibold">Could not load {surface}</h2>

        <p className="text-muted mt-2 text-sm leading-6">
          The admin API did not return data. This is usually transient — retry first, then check
          that the API and database are reachable.
        </p>

        <p className="border-border bg-card text-muted mt-4 overflow-x-auto rounded-lg border px-3 py-2 text-left font-mono text-xs">
          {message || "Unknown error"}
          {digest ? (
            <>
              <br />
              <span className="opacity-70">digest: {digest}</span>
            </>
          ) : null}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => retry()}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>

          <Button asChild size="sm" variant="secondary">
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
