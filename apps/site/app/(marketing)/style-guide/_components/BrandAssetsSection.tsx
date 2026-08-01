import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Info } from "lucide-react";

import { Card } from "@veriworkly/ui";
import { LogoMarkMono } from "@/components/brand/LogoMarkMono";

import { SectionHeader } from "./SectionHeader";

const MARK = "/brand/logo/veriworkly-logo.svg";

const REFERENCES = [
  {
    title: "Theme tokens",
    detail: "packages/ui/src/styles/themes.css",
    href: "https://github.com/VeriWorkly/veriworkly/blob/master/packages/ui/src/styles/themes.css",
  },
  {
    title: "Published palette",
    detail: "apps/site/config/brand.ts",
    href: "https://github.com/VeriWorkly/veriworkly/blob/master/apps/site/config/brand.ts",
  },
  {
    title: "Logo source",
    detail: "apps/site/public/brand/logo/",
    href: "https://github.com/VeriWorkly/veriworkly/tree/master/apps/site/public/brand/logo",
  },
  {
    title: "UI package",
    detail: "packages/ui",
    href: "https://github.com/VeriWorkly/veriworkly/tree/master/packages/ui",
  },
];

export const BrandAssetsSection = () => {
  return (
    <section id="brand-assets" className="scroll-mt-24 space-y-8">
      <SectionHeader icon={Info} title="Brand Assets" />

      <Card className="space-y-6 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-lg font-semibold">Primary Logo</p>

            <p className="text-muted text-sm leading-6">
              The mark ships as vector. Reach for{" "}
              <span className="font-mono text-xs">veriworkly-logo.svg</span> on product surfaces,
              and the single-colour version wherever the facets would lose contrast.
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
            <div className="border-border bg-background grid size-24 place-items-center rounded-2xl border">
              <Image width={56} height={56} alt="VeriWorkly logo" src={MARK} unoptimized />
            </div>

            <div
              className="border-border grid size-24 place-items-center rounded-2xl border text-[#F3F4F6]"
              style={{ backgroundColor: "#0D1117" }}
            >
              <LogoMarkMono size={56} />
            </div>
          </div>
        </div>

        <Link
          href="/brand-kit"
          className="group border-accent/30 bg-accent/5 hover:bg-accent/10 focus-visible:ring-accent flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <div>
            <p className="text-accent text-sm font-semibold">Need the full brand kit?</p>
            <p className="text-muted mt-1 text-xs">
              Vector and raster logos, clear-space rules, both palettes, typography, voice
              guidelines, share cards, and a downloadable .zip.
            </p>
          </div>

          <ExternalLink
            className="text-accent size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </Link>

        <div className="grid gap-4 sm:grid-cols-2">
          {REFERENCES.map((reference) => (
            <Link
              key={reference.href}
              href={reference.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group border-border bg-background hover:bg-muted/10 focus-visible:ring-accent block rounded-2xl border p-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="group-hover:text-accent text-sm font-semibold transition-colors duration-200">
                    {reference.title}
                  </p>

                  <p className="text-muted mt-1 truncate font-mono text-xs">{reference.detail}</p>
                </div>

                <ExternalLink
                  className="size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
};
