"use client";

import Link from "next/link";
import { ArrowUpRight, RotateCw } from "lucide-react";

import { siteConfig } from "@/config/site";

import { PageHero } from "@/components/marketing/PageLayout";

export default function StatsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <>
      <p className="sr-only" role="alert">
        The development statistics could not be loaded.
      </p>

      <PageHero
        className="border-b-0"
        title="The board"
        highlight="didn't load."
        lede="Something went wrong while reading the development board from our server. The board itself is public on GitHub, so nothing is lost: try again, or read it there."
        aside={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="group bg-foreground text-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent/40 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
            >
              <RotateCw
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:rotate-90"
              />
              Try again
            </button>
            <Link
              target="_blank"
              rel="noopener noreferrer"
              href={siteConfig.links.github}
              className="border-border hover:bg-card focus-visible:ring-accent/40 inline-flex h-12 items-center gap-2 rounded-full border px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
            >
              Open GitHub
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        }
      />
    </>
  );
}
