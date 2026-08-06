"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@veriworkly/ui";

interface AdminErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** What failed, in the operator's terms — "the users list", "the dashboard". */
  surface?: string;
}

/**
 * The shared body of every admin `error.tsx`.
 *
 * `fetchAdmin` throws rather than returning a partial shape, on the reasoning that an ops
 * dashboard silently rendering zeros is worse than one showing an error. That reasoning only
 * holds if something catches the throw and explains it — before this, nothing under `/admin`
 * had an error boundary at all, so any API hiccup dropped the operator onto Next's raw error
 * screen with no way back into the panel.
 *
 * The message is shown verbatim because the only audience is the admin: these strings come from
 * `fetchAdmin` and already carry the upstream status code, which is the single most useful
 * thing to know when deciding whether to retry or go look at the API.
 */
const AdminErrorState = ({ error, reset, surface = "this page" }: AdminErrorStateProps) => {
  const router = useRouter();

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
          {error.message || "Unknown error"}
          {error.digest ? (
            <>
              <br />
              <span className="opacity-70">digest: {error.digest}</span>
            </>
          ) : null}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              // `reset()` alone re-renders the boundary but reuses the cached failed render;
              // refreshing first makes the server component actually re-run its fetches.
              router.refresh();
              reset();
            }}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>

          <Link href="/admin">
            <Button size="sm" variant="secondary">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminErrorState;
