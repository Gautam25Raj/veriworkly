import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Download, X, Check } from "lucide-react";

import { Card } from "@veriworkly/ui";

import BrandSectionHeader from "./BrandSectionHeader";

const LOGO_FILES = [
  { name: "Primary Mark", file: "veriworkly-logo-256.png", size: "256×256" },
  { name: "App Icon", file: "veriworkly-icon-512.png", size: "512×512" },
  { name: "App Icon (Small)", file: "veriworkly-icon-192.png", size: "192×192" },
  { name: "Apple Touch Icon", file: "veriworkly-icon-apple-touch.png", size: "180×180" },
];

const DONT_EXAMPLES = [
  { label: "Don't recolor the mark", className: "hue-rotate-180 saturate-200" },
  { label: "Don't distort proportions", className: "scale-x-150" },
  { label: "Don't rotate the mark", className: "rotate-45" },
  { label: "Don't add effects or shadows", className: "drop-shadow-[0_0_18px_rgba(37,99,235,0.9)] blur-[1px]" },
];

const LogoSection = () => {
  return (
    <section id="logo" className="scroll-mt-24 space-y-8">
      <BrandSectionHeader
        icon={ImageIcon}
        title="Logo"
        description="The VeriWorkly mark is a single square icon — there is no separate wordmark lockup. Pair it with the 'VeriWorkly' name set in the brand typeface when you need a text label."
      />

      <Card className="space-y-6 p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="border-border bg-background flex size-32 shrink-0 items-center justify-center rounded-2xl border p-6">
            <Image
              src="/veriworkly-logo.png"
              alt="VeriWorkly logo"
              width={80}
              height={80}
              className="h-auto w-full"
            />
          </div>

          <div className="space-y-1.5 text-center sm:text-left">
            <p className="text-foreground text-lg font-semibold">VeriWorkly Mark</p>
            <p className="text-muted max-w-md text-sm leading-relaxed">
              Keep clear space around the mark equal to at least 25% of its width, and always
              display it on a background that preserves contrast.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LOGO_FILES.map((asset) => (
            <Link
              key={asset.file}
              href={`/brand/logo/${asset.file}`}
              download
              className="group border-border bg-background hover:bg-muted/10 flex flex-col gap-3 rounded-2xl border p-4 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <p className="group-hover:text-accent text-sm font-semibold transition-colors duration-200">
                  {asset.name}
                </p>
                <Download className="size-4 shrink-0 opacity-60 transition-transform duration-200 group-hover:translate-y-0.5" />
              </div>
              <p className="text-muted font-mono text-xs">{asset.size} · PNG</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4 p-8">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Check className="size-4" aria-hidden="true" />
            <p className="text-sm font-semibold">Do</p>
          </div>

          <div className="border-border bg-background flex size-20 items-center justify-center rounded-xl border p-4">
            <Image src="/veriworkly-logo.png" alt="Correct logo usage" width={48} height={48} />
          </div>

          <ul className="text-muted space-y-1.5 text-sm leading-relaxed">
            <li>Use the mark at its original proportions and colors</li>
            <li>Maintain clear space equal to 25% of the mark&apos;s width</li>
            <li>Use &quot;VeriWorkly&quot; as one capitalized word in text</li>
          </ul>
        </Card>

        <Card className="space-y-4 p-8">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
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
                  src="/veriworkly-logo.png"
                  alt={example.label}
                  width={32}
                  height={32}
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
