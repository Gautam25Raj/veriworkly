"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: this replaces the root layout entirely, so it must render its
 * own <html>/<body> and cannot rely on anything the layout provides — no theme
 * provider, no fonts, no guarantee the app stylesheet was applied.
 *
 * Everything here is therefore self-contained inline styling, with dark mode driven
 * straight off `prefers-color-scheme` rather than the `.dark` class next-themes would
 * normally have set. `app/error.tsx` handles the ordinary case and keeps full branding;
 * this only runs when that boundary itself could not mount.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#f5f4ef",
          color: "#171717",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background-color: #0d1117 !important; color: #f3f4f6 !important; }
            .vw-ge-muted { color: #94a3b8 !important; }
            .vw-ge-button { background-color: #60a5fa !important; color: #0f172a !important; }
            .vw-ge-link { color: #60a5fa !important; }
          }
          .vw-ge-button:focus-visible, .vw-ge-link:focus-visible {
            outline: 2px solid #2563eb;
            outline-offset: 2px;
          }
        `}</style>

        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#dc2626",
            }}
          >
            Application Error
          </p>

          <h1
            style={{
              margin: "1rem 0 0",
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            This page couldn&rsquo;t load
          </h1>

          <p
            className="vw-ge-muted"
            style={{ margin: "1rem 0 0", lineHeight: 1.7, color: "#5f5c54" }}
          >
            Something failed before the page could start. This is usually temporary — trying again
            often resolves it.
          </p>

          {error.digest && (
            <p
              className="vw-ge-muted"
              style={{
                margin: "1.5rem 0 0",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#5f5c54",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
              marginTop: "2rem",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              className="vw-ge-button"
              style={{
                cursor: "pointer",
                border: 0,
                borderRadius: "9999px",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                backgroundColor: "#2563eb",
                color: "#ffffff",
              }}
            >
              Try again
            </button>

            <a
              href="/"
              className="vw-ge-link"
              style={{
                borderRadius: "9999px",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#2563eb",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
