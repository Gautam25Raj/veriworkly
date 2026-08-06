import { cn } from "@veriworkly/ui";

import { chartColor, chartFillId, type ChartSeries } from "./ChartDefs";
import { buildAreaPath, buildLinePath, computeScale, toPoints } from "./geometry";

interface SparklineProps {
  values: number[];
  series?: ChartSeries;
  className?: string;
}

/**
 * The small trend line that sits inside a KPI card.
 *
 * Deliberately axis-less and label-less: at this size a tick label is unreadable, so the
 * sparkline's only job is to answer "which way, and how steadily". The exact numbers are the
 * card's headline value and delta directly above it, which is also why this is `aria-hidden` —
 * to a screen reader it would be a redundant, unreadable duplicate of those.
 */
const Sparkline = ({ values, series = 1, className }: SparklineProps) => {
  // Drawn in a fixed coordinate space and stretched by the viewBox, so no resize observer is
  // needed to fill whatever width the card grid hands it.
  const width = 100;
  const height = 36;

  const points = toPoints(values, width, height, computeScale(values, 1.25));

  if (points.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path d={buildAreaPath(points, height)} fill={`url(#${chartFillId(series)})`} />

      <path
        d={buildLinePath(points)}
        fill="none"
        stroke={chartColor(series)}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        // The viewBox scales non-uniformly; without this the stroke thins out at wide widths.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default Sparkline;
