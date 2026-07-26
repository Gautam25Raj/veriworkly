import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Card } from "@veriworkly/ui";
import { type Competitor } from "@/config/compare";

const CompetitorCard = ({ competitor }: { competitor: Competitor }) => {
  return (
    <Link href={`/compare/${competitor.id}`} className="group block h-full">
      <Card className="hover:border-accent/40 relative flex h-full flex-col gap-4 overflow-hidden p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: competitor.color }}
          aria-hidden="true"
        />

        <div className="flex items-center gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-white"
            style={{ backgroundColor: competitor.color }}
            aria-hidden="true"
          >
            {competitor.initials}
          </div>

          <div className="min-w-0">
            <p className="text-foreground group-hover:text-accent truncate font-semibold transition-colors">
              VeriWorkly vs {competitor.name}
            </p>
          </div>
        </div>

        <p className="text-muted line-clamp-3 text-sm leading-relaxed">{competitor.positioning}</p>

        <div className="border-border/40 mt-auto flex items-start gap-2 border-t pt-4">
          <Sparkles className="text-accent mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p className="text-muted line-clamp-2 text-xs leading-relaxed">
            {competitor.standoutFeature}
          </p>
        </div>

        <div className="text-accent flex items-center gap-1.5 text-xs font-semibold">
          Compare features & pricing
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
};

export default CompetitorCard;
