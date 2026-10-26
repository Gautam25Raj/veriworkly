"use client";

import { useEffect } from "react";

import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own document and styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <title>Something went wrong | VeriWorkly Studio</title>

        <main className="grid min-h-dvh place-items-center p-6">
          <section className="border-border bg-card w-full max-w-lg rounded-3xl border p-8 text-center">
            <p className="text-accent text-xs font-semibold tracking-[0.2em] uppercase">
              Studio Error
            </p>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              VeriWorkly Studio could not load
            </h1>

            <p className="text-muted mt-3 text-sm leading-6">
              This is usually temporary. Try again in a moment.
            </p>

            <button
              type="button"
              onClick={() => retry()}
              className="bg-accent text-accent-foreground mt-6 inline-flex min-h-10 items-center justify-center rounded-lg px-5 text-sm font-bold"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
