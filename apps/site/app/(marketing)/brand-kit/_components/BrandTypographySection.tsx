import { Type } from "lucide-react";

import { Card } from "@veriworkly/ui";

import BrandSectionHeader from "./BrandSectionHeader";

const TYPOGRAPHY_SAMPLES = [
  {
    label: "Display / Hero",
    title: "Build a resume that actually gets read",
    className: "text-4xl font-semibold tracking-tight sm:text-5xl",
    description: "text-4xl sm:text-5xl / font-semibold / tracking-tight",
  },
  {
    label: "Section Header",
    title: "One profile. Every document.",
    className: "text-3xl font-semibold tracking-tight",
    description: "text-3xl / font-semibold / tracking-tight",
  },
  {
    label: "Component Header",
    title: "Privacy-first by default",
    className: "text-xl font-semibold tracking-tight",
    description: "text-xl / font-semibold / tracking-tight",
  },
];

const BrandTypographySection = () => {
  return (
    <section id="typography" className="scroll-mt-24 space-y-8">
      <BrandSectionHeader
        icon={Type}
        title="Typography"
        description="Geist Sans for interface and body copy, Geist Mono for labels, code, and metadata."
      />

      <Card className="divide-border divide-y overflow-hidden p-0">
        {TYPOGRAPHY_SAMPLES.map((sample) => (
          <div key={sample.label} className="space-y-4 p-8">
            <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
              {sample.label}
            </p>
            <p className={sample.className}>{sample.title}</p>
            <p className="text-muted text-sm italic">{sample.description}</p>
          </div>
        ))}

        <div className="space-y-4 p-8">
          <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">Font Stack</p>

          <p className="text-base leading-7">
            Primary font: <span className="font-mono">Geist Sans</span> —{" "}
            <span className="font-mono">var(--font-geist-sans)</span>
          </p>

          <p className="text-base leading-7">
            Monospace font: <span className="font-mono">Geist Mono</span> —{" "}
            <span className="font-mono">var(--font-geist-mono)</span>
          </p>

          <p className="text-muted text-sm italic">
            Both are bundled and exposed through the @veriworkly/ui package — no separate font
            license or download is required to reference them.
          </p>
        </div>
      </Card>
    </section>
  );
};

export default BrandTypographySection;
