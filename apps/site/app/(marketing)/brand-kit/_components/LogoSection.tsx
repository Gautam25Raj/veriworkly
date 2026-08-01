import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Download, X, Check } from "lucide-react";

import { Card } from "@veriworkly/ui";
import { LogoMarkMono } from "@/components/brand/LogoMarkMono";
import { logoAssets, logoRules } from "@/config/brand";

import BrandSectionHeader from "./BrandSectionHeader";

const MARK = "/brand/logo/veriworkly-logo.svg";

const DONT_EXAMPLES = [
  { label: "Don't recolor the mark", className: "hue-rotate-180 saturate-200" },
  { label: "Don't distort proportions", className: "scale-x-150" },
  { label: "Don't rotate the mark", className: "rotate-45" },
  {
    label: "Don't add effects or shadows",
    className: "drop-shadow-[0_0_18px_rgba(37,99,235,0.9)] blur-[1px]",
  },
];

const clearSpacePct = `${logoRules.clearSpaceRatio * 100}%`;

const LogoSection = () => {
  return (
    <section id="logo" className="scroll-mt-24 space-y-8">
      <BrandSectionHeader
        icon={ImageIcon}
        title="Logo"
        description="The VeriWorkly mark is a faceted W with a period — a single square icon, with no separate wordmark lockup. Pair it with the 'VeriWorkly' name set in Geist Sans when you need a text label."
      />

      <Card className="space-y-8 p-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Clear space, drawn rather than described. */}
          <div className="space-y-3">
            <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
              Clear space
            </p>

            <div className="border-accent/40 bg-background relative mx-auto grid aspect-square w-full max-w-60 place-items-center rounded-lg border border-dashed">
              <span className="text-accent absolute top-1.5 left-2 font-mono text-[10px] tracking-wider uppercase">
                {clearSpacePct} of width
              </span>

              {/* The inner box is 1 / (1 + 2 × ratio) of the frame, so the visible
                  margin on each side is exactly the clear-space ratio. */}
              <div
                className="border-border bg-card grid place-items-center rounded-md border"
                style={{ width: "66.67%", height: "66.67%", padding: "12%" }}
              >
                <Image
                  src={MARK}
                  alt="VeriWorkly mark inside its clear-space boundary"
                  width={80}
                  height={80}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
            </div>

            <p className="text-muted text-sm leading-relaxed">
              Keep clear space on every side equal to at least {clearSpacePct} of the mark&apos;s
              width. Nothing — type, rules, other logos, or the edge of a photo — enters that box.
            </p>
          </div>

          {/* Minimum sizes, shown at true scale. */}
          <div className="space-y-3">
            <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
              Minimum size
            </p>

            <div className="border-border bg-background flex min-h-60 flex-wrap items-end justify-center gap-6 rounded-lg border p-6">
              {[
                { px: 16, mono: true, note: "Favicon" },
                { px: 24, mono: true, note: "Single colour" },
                { px: 32, mono: false, note: "Full colour min" },
                { px: 64, mono: false, note: "Comfortable" },
              ].map((item) => (
                <div key={item.px} className="flex flex-col items-center gap-2">
                  <div className="text-foreground flex items-end" style={{ height: 64 }}>
                    {item.mono ? (
                      <LogoMarkMono size={item.px} />
                    ) : (
                      <Image
                        src={MARK}
                        alt={`VeriWorkly mark at ${item.px} pixels`}
                        width={item.px}
                        height={item.px}
                        unoptimized
                        style={{ width: item.px, height: item.px }}
                      />
                    )}
                  </div>

                  <p className="text-muted font-mono text-[10px] tabular-nums">{item.px}px</p>
                  <p className="text-muted max-w-18 text-center text-[10px] leading-tight">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-muted text-sm leading-relaxed">
              The faceted mark holds together down to {logoRules.minSizePx}px. At{" "}
              {logoRules.monoBelowPx}px and below, the facets muddy — switch to the single-colour
              mark.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {logoAssets.map((asset) => (
            <Link
              key={asset.file}
              href={`/brand/logo/${asset.file}`}
              download
              className="group border-border bg-background hover:bg-muted/10 focus-visible:ring-accent flex flex-col gap-2 rounded-2xl border p-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="group-hover:text-accent text-sm font-semibold transition-colors duration-200">
                  {asset.name}
                </p>

                <Download
                  className="size-4 shrink-0 opacity-60 transition-transform duration-200 group-hover:translate-y-0.5"
                  aria-hidden="true"
                />
              </div>

              <p className="text-muted font-mono text-xs">
                {asset.size} · {asset.format}
              </p>

              <p className="text-muted text-xs leading-relaxed">{asset.usage}</p>
            </Link>
          ))}
        </div>
      </Card>

      {/* Which mark on which ground. */}
      <Card className="space-y-4 p-8">
        <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
          Choosing a variant
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <div
              className="border-border grid h-28 place-items-center rounded-2xl border"
              style={{ backgroundColor: "#F5F4EF" }}
            >
              <Image
                src={MARK}
                alt="Primary mark on the light background"
                width={56}
                height={56}
                unoptimized
              />
            </div>

            <p className="text-sm font-semibold">Primary on light</p>
            <p className="text-muted text-xs leading-relaxed">
              The default. Use on ivory, white, and any pale ground.
            </p>
          </div>

          <div className="space-y-2">
            <div
              className="border-border grid h-28 place-items-center rounded-2xl border"
              style={{ backgroundColor: "#0D1117" }}
            >
              <Image
                src={MARK}
                alt="Primary mark on the dark background"
                width={56}
                height={56}
                unoptimized
              />
            </div>

            <p className="text-sm font-semibold">Primary on dark</p>
            <p className="text-muted text-xs leading-relaxed">
              Works down to about 32px. Below that the deepest facets merge into the ground.
            </p>
          </div>

          <div className="space-y-2">
            <div
              className="border-border grid h-28 place-items-center rounded-2xl border text-[#F3F4F6]"
              style={{ backgroundColor: "#0D1117" }}
            >
              <LogoMarkMono size={56} />
            </div>

            <p className="text-sm font-semibold">Reversed</p>
            <p className="text-muted text-xs leading-relaxed">
              The single-colour mark in Foreground. Use on photos, colour fills, and at small sizes.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4 p-8">
          <div className="text-success flex items-center gap-2">
            <Check className="size-4" aria-hidden="true" />
            <p className="text-sm font-semibold">Do</p>
          </div>

          <div className="border-border bg-background flex size-20 items-center justify-center rounded-xl border p-4">
            <Image src={MARK} alt="Correct logo usage" width={48} height={48} unoptimized />
          </div>

          <ul className="text-muted space-y-1.5 text-sm leading-relaxed">
            <li>Use the SVG wherever the medium accepts it</li>
            <li>Keep the mark at its original proportions and colours</li>
            <li>Maintain clear space equal to {clearSpacePct} of the mark&apos;s width</li>
            <li>Write &quot;VeriWorkly&quot; as one word, capital V and W</li>
          </ul>
        </Card>

        <Card className="space-y-4 p-8">
          <div className="text-destructive flex items-center gap-2">
            <X className="size-4" aria-hidden="true" />
            <p className="text-sm font-semibold">Don&apos;t</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {DONT_EXAMPLES.map((example) => (
              <div
                key={example.label}
                title={example.label}
                className="border-border bg-background flex size-16 items-center justify-center overflow-hidden rounded-xl border p-3"
              >
                <Image
                  src={MARK}
                  alt={example.label}
                  width={32}
                  height={32}
                  unoptimized
                  className={example.className}
                />
              </div>
            ))}
          </div>

          <ul className="text-muted space-y-1.5 text-sm leading-relaxed">
            {DONT_EXAMPLES.map((example) => (
              <li key={example.label}>{example.label}</li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
};

export default LogoSection;
