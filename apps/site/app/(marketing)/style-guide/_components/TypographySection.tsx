import { Type } from "lucide-react";

import { Card } from "@veriworkly/ui";

import { SectionHeader } from "./SectionHeader";

const TYPOGRAPHY_SAMPLES = [
  {
    label: "Display",
    title: "Heading 1 (Hero)",
    className: "text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl",
    description: "text-4xl sm:text-5xl md:text-6xl / font-semibold / tracking-tight",
    tag: "p",
  },
  {
    label: "Section Header",
    title: "Heading 2 (Section)",
    className: "text-3xl font-semibold tracking-tight",
    description: "text-3xl / font-semibold / tracking-tight",
    tag: "h2",
  },
  {
    label: "Component Header",
    title: "Heading 3 (Card Title)",
    className: "text-xl font-semibold tracking-tight",
    description: "text-xl / font-semibold / tracking-tight",
    tag: "h3",
  },
];

export const TypographySection = () => {
  return (
    <section id="typography" className="scroll-mt-24 space-y-8">
      <SectionHeader icon={Type} title="Typography" />

      <Card className="divide-border divide-y overflow-hidden">
        {TYPOGRAPHY_SAMPLES.map((sample, index) => (
          <div key={index} className="space-y-4 p-8">
            <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">
              {sample.label}
            </p>

            {sample.tag === "h2" ? (
              <h2 className={sample.className}>{sample.title}</h2>
            ) : sample.tag === "h3" ? (
              <h3 className={sample.className}>{sample.title}</h3>
            ) : (
              <p className={sample.className}>{sample.title}</p>
            )}

            <p className="text-muted text-sm italic">{sample.description}</p>
          </div>
        ))}

        <div className="space-y-4 p-8">
          <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">Body Text</p>

          <p className="text-base leading-8 md:text-lg">
            The quick brown fox jumps over the lazy dog. This is the primary body text used for
            descriptions and long-form content. It prioritizes readability and proper line spacing.
          </p>

          <p className="text-muted text-sm italic">text-base leading-8 md:text-lg</p>
        </div>

        <div className="space-y-4 p-8">
          <p className="text-muted text-xs font-semibold tracking-[0.24em] uppercase">Font Stack</p>

          <p className="text-base leading-7">
            Primary font token: <span className="font-mono">--font-geist-sans</span>
          </p>

          <p className="text-base leading-7">
            Monospace token: <span className="font-mono">--font-geist-mono</span>
          </p>

          <p className="text-muted text-sm italic">
            Configured through @veriworkly/ui font variables and consumed by each app.
          </p>
        </div>
      </Card>
    </section>
  );
};
