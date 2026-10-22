"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";

import { StatusPage, statusAction } from "@/components/marketing/StatusPage";

/**
 * Catches failures outside the marketing layout (and in the layout itself), so it cannot lean
 * on the navbar or footer being able to render.
 */
const Error = ({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) => {
  useEffect(() => {
    console.error("Root error boundary caught error:", error);
  }, [error]);

  return (
    <div role="alert">
      <StatusPage
        as="main"
        title="Something"
        highlight="went wrong."
        lede="The page failed to load on our side. Nothing you were working on is lost: your documents live in your browser. Try again, or head back home."
        actions={
          <>
            <button
              type="button"
              onClick={() => retry()}
              className={`group ${statusAction.primary}`}
            >
              <RotateCw
                aria-hidden="true"
                className="size-4 transition-transform duration-500 group-hover:rotate-180"
              />
              Try again
            </button>

            <Link href="/" className={statusAction.secondary}>
              Back to home
            </Link>
          </>
        }
      />
    </div>
  );
};

export default Error;
