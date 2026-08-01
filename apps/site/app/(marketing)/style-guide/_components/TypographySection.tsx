import { Type } from "lucide-react";

import { Card } from "@veriworkly/ui";
import { fontStack, typeScale } from "@/config/brand";

import { SectionHeader } from "./SectionHeader";

const SPECIMEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";

export const TypographySection = () => {
  return (
    <section id="typography" className="scroll-mt-24 space-y-8">
      <SectionHeader icon={Type} title="Typography" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-8">
          <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
            {fontStack.sans.family}
          </p>

          <p className="text-3xl leading-tight font-semibold tracking-tight">Aa Bb Cc</p>

          <p className="text-sm leading-relaxed wrap-break-word">{SPECIMEN}</p>

          <p className="text-muted font-mono text-xs">var({fontStack.sans.variable})</p>
          <p className="text-muted text-xs leading-relaxed">{fontStack.sans.usage}</p>
        </Card>

        <Card className="space-y-4 p-8">
          <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
            {fontStack.mono.family}
          </p>

          <p className="font-mono text-3xl leading-tight font-semibold">Aa Bb Cc</p>

          <p className="font-mono text-sm leading-relaxed wrap-break-word">{SPECIMEN}</p>

          <p className="text-muted font-mono text-xs">var({fontStack.mono.variable})</p>
          <p className="text-muted text-xs leading-relaxed">{fontStack.mono.usage}</p>
        </Card>
      </div>

      <Card className="divide-border divide-y overflow-hidden p-0">
        {typeScale.map((step) => (
          <div key={step.label} className="space-y-4 p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
                {step.label}
              </p>

              <p className="text-muted font-mono text-xs tabular-nums">
                {step.sizes} · {step.weight} · {step.tracking} · {step.lineHeight}
              </p>
            </div>

            <p className={step.className}>{step.usage}</p>

            <p className="text-muted font-mono text-[11px] wrap-break-word">{step.className}</p>
          </div>
        ))}
      </Card>
    </section>
  );
};
