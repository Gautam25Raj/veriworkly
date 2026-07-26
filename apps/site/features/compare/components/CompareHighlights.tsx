import { Sparkles, TriangleAlert, ArrowRightLeft } from "lucide-react";

import { Card } from "@veriworkly/ui";
import { type Competitor } from "@/config/compare";

const CompareHighlights = ({ competitor }: { competitor: Competitor }) => {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="space-y-2.5 border-emerald-500/15 bg-emerald-500/4 p-6 transition-all duration-300 ease-out hover:-translate-y-1">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-4" aria-hidden="true" />
          <p className="font-mono text-[10px] font-bold tracking-widest uppercase">
            {competitor.name}&apos;s strength
          </p>
        </div>
        <p className="text-muted text-sm leading-relaxed">{competitor.standoutFeature}</p>
      </Card>

      <Card className="space-y-2.5 border-amber-500/15 bg-amber-500/4 p-6 transition-all duration-300 ease-out hover:-translate-y-1">
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <p className="font-mono text-[10px] font-bold tracking-widest uppercase">Worth knowing</p>
        </div>
        <p className="text-muted text-sm leading-relaxed">{competitor.knownLimitation}</p>
      </Card>

      <Card className="border-accent/30 bg-accent/4 space-y-2.5 border-2 p-6 transition-all duration-300 ease-out hover:-translate-y-1">
        <div className="text-accent flex items-center gap-1.5">
          <ArrowRightLeft className="size-4" aria-hidden="true" />
          <p className="font-mono text-[10px] font-bold tracking-widest uppercase">
            Why people switch
          </p>
        </div>
        <p className="text-muted text-sm leading-relaxed">{competitor.whySwitch}</p>
      </Card>
    </div>
  );
};

export default CompareHighlights;
