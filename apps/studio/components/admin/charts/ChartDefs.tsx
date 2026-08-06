/**
 * The six area-fill gradients every admin chart references, defined once per page.
 *
 * SVG gradients have to be declared in a `<defs>` and referenced by `url(#id)`. Generating an
 * id per chart would need `useId`, which would force every chart to become a client component
 * purely to own a string — the charts are otherwise pure render from server-fetched data and
 * ship no JS at all. Declaring the gradients once in the admin shell instead keeps them as
 * server components, and means N sparklines on the dashboard share six gradient definitions
 * rather than emitting N of their own.
 */

export const CHART_SERIES = [1, 2, 3, 4, 5, 6] as const;

export type ChartSeries = (typeof CHART_SERIES)[number];

export function chartFillId(series: ChartSeries) {
  return `admin-chart-fill-${series}`;
}

export function chartColor(series: ChartSeries) {
  return `var(--chart-${series})`;
}

const ChartDefs = () => (
  <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute h-0 w-0">
    <defs>
      {CHART_SERIES.map((series) => (
        <linearGradient key={series} id={chartFillId(series)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartColor(series)} stopOpacity="0.24" />
          <stop offset="100%" stopColor={chartColor(series)} stopOpacity="0" />
        </linearGradient>
      ))}
    </defs>
  </svg>
);

export default ChartDefs;
