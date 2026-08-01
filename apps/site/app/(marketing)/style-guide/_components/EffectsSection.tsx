import { Sparkles } from "lucide-react";

import { Card } from "@veriworkly/ui";

import { SectionHeader } from "./SectionHeader";

export const EffectsSection = () => {
  return (
    <section id="effects" className="scroll-mt-24 space-y-8">
      <SectionHeader icon={Sparkles} title="Visual Effects & Patterns" />

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="space-y-6 p-8">
          <h3 className="text-lg font-semibold">Surface Grid</h3>
          <p className="text-muted text-sm leading-relaxed">
            Our signature background pattern used for major layouts and landing sections.
          </p>

          <div className="surface-grid border-border h-48 rounded-xl border">
            <div className="flex h-full items-center justify-center bg-white/40 backdrop-blur-[2px] dark:bg-black/40">
              <span className="text-muted font-mono text-xs tracking-widest uppercase">
                Grid System (28px)
              </span>
            </div>
          </div>
        </Card>

        <Card className="space-y-6 p-8">
          <h3 className="text-lg font-semibold">Premium Shadows</h3>

          <p className="text-muted text-sm leading-relaxed">
            We use deep, soft shadows to create elevation and focus on premium components.
          </p>

          <div className="flex h-48 items-center justify-center">
            <div className="bg-card border-border flex size-32 items-center justify-center rounded-4xl border font-mono text-[10px] font-bold uppercase shadow-[0_30px_90px_-50px_rgba(0,0,0,0.45)]">
              Elevated Card
            </div>
          </div>
        </Card>

        <Card className="col-span-full space-y-6 p-8">
          <h3 className="text-lg font-semibold">Gradients</h3>

          <p className="text-muted text-sm leading-relaxed">
            Subtle gradients are applied to backgrounds and card surfaces to add depth.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Both swatches read from the live tokens rather than baked hexes, so they
                follow the page into dark mode the way the real surfaces do. */}
            <div className="space-y-3">
              <p className="text-muted text-xs font-semibold tracking-wider uppercase">
                Page Background (Radial)
              </p>

              <div
                className="border-accent/10 h-32 rounded-xl border"
                style={{
                  background:
                    "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 28%), radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 8%, transparent), transparent 22%), var(--background)",
                }}
              />

              <p className="text-muted font-mono text-[11px] leading-relaxed">
                Applied to <span className="text-accent">body</span> globally.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-muted text-xs font-semibold tracking-wider uppercase">
                Inner Depth (Linear)
              </p>

              <div
                className="border-border h-32 rounded-xl border"
                style={{
                  background:
                    "linear-gradient(145deg, var(--card), color-mix(in oklab, var(--card) 88%, var(--foreground)))",
                }}
              />

              <p className="text-muted font-mono text-[11px] leading-relaxed">
                Card surfaces, 145° from <span className="text-accent">--card</span>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
