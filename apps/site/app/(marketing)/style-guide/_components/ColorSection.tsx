import { Palette } from "lucide-react";

import { TokenSwatch } from "@/components/brand/TokenSwatch";
import { brandColors } from "@/config/brand";

import { SectionHeader } from "./SectionHeader";

export const ColorSection = () => {
  const core = brandColors.filter((token) => token.core);
  const rest = brandColors.filter((token) => !token.core);

  return (
    <section id="colors" className="scroll-mt-24 space-y-8">
      <SectionHeader icon={Palette} title="Colors" />

      <p className="text-muted max-w-3xl text-sm leading-relaxed">
        Every token carries a light and a dark value, both read from{" "}
        <code className="font-mono text-xs">packages/ui/src/styles/themes.css</code>. Each swatch
        shows the two side by side, composited over the page background of its own theme so that
        alpha tokens like <code className="font-mono text-xs">--border</code> read honestly.
      </p>

      <div className="space-y-6">
        <h3 className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
          Core palette
        </h3>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {core.map((token) => (
            <TokenSwatch key={token.variable} {...token} />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
          Status &amp; internal tokens
        </h3>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((token) => (
            <TokenSwatch key={token.variable} {...token} />
          ))}
        </div>
      </div>
    </section>
  );
};
