import Link from "next/link";
import { Download } from "lucide-react";

const BrandKitHeader = () => {
  return (
    <header className="space-y-4">
      <p className="text-accent text-xs font-semibold tracking-[0.28em] uppercase">Press & Brand</p>

      <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
        Brand Kit
      </h1>

      <p className="text-muted max-w-2xl text-base leading-8 md:text-lg">
        Logos, colors, typography, and voice guidelines for writing or designing about VeriWorkly —
        in blog posts, integrations, comparisons, or press coverage.
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/brand/veriworkly-brand-kit.zip"
          download
          className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
        >
          <Download className="size-4" aria-hidden="true" />
          Download Brand Kit (.zip)
        </Link>

        <Link href="/style-guide" className="text-accent text-sm font-semibold hover:underline">
          View Full Design System
        </Link>

        <span className="text-muted text-xs">•</span>

        <Link
          href="https://github.com/VeriWorkly/veriworkly"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground text-sm transition-colors"
        >
          Source on GitHub
        </Link>
      </div>
    </header>
  );
};

export default BrandKitHeader;
