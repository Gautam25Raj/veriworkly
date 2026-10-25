#!/usr/bin/env node
// Renders an Artillery JSON report (from `artillery run -o report.json`) into
// a single self-contained HTML file with latency/RPS-over-time charts and a
// per-endpoint breakdown.
//
// Artillery's own `artillery report` command is deprecated as of Artillery
// 2.x (it prints a notice and produces nothing - see
// https://github.com/artilleryio/artillery, "report" command), so this
// replaces it rather than wrapping it.
//
// Usage: node load-testing/render-report.mjs <report.json> <out.html> [appLabel] [environment]

import { readFileSync, writeFileSync } from "node:fs";

const [, , jsonPath, htmlPath, appLabel = "app", environment = "local"] = process.argv;

if (!jsonPath || !htmlPath) {
  console.error("Usage: node render-report.mjs <report.json> <out.html> [appLabel] [environment]");
  process.exit(1);
}

const report = JSON.parse(readFileSync(jsonPath, "utf8"));
const { aggregate, intermediate = [] } = report;

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function fmt(n, digits = 1) {
  if (n === undefined || n === null || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits).replace(/\.0$/, "");
}

const t0 = intermediate.length ? intermediate[0].firstMetricAt : aggregate.firstMetricAt;
const series = intermediate.map((entry) => {
  const rt = entry.summaries["http.response_time"] || {};
  const errorCount = Object.entries(entry.counters || {}).reduce((sum, [key, value]) => {
    return /^http\.codes\.[45]\d\d$/.test(key) ? sum + value : sum;
  }, 0);

  return {
    t: (entry.firstMetricAt - t0) / 1000,
    rps: entry.rates?.["http.request_rate"] ?? 0,
    p50: rt.p50 ?? 0,
    p95: rt.p95 ?? 0,
    p99: rt.p99 ?? 0,
    requests: entry.counters?.["http.requests"] ?? 0,
    errors: errorCount,
  };
});

const totalRequests = aggregate.counters?.["http.requests"] ?? 0;
const totalErrors = Object.entries(aggregate.counters || {}).reduce((sum, [key, value]) => {
  return /^http\.codes\.[45]\d\d$/.test(key) ? sum + value : sum;
}, 0);
const failedVusers = aggregate.counters?.["vusers.failed"] ?? 0;
const completedVusers = aggregate.counters?.["vusers.completed"] ?? 0;
const errorRate = totalRequests ? (totalErrors / totalRequests) * 100 : 0;
const overallRt = aggregate.summaries?.["http.response_time"] || {};
const durationSec =
  aggregate.lastMetricAt && aggregate.firstMetricAt
    ? (aggregate.lastMetricAt - aggregate.firstMetricAt) / 1000
    : 0;

const statusCodes = Object.entries(aggregate.counters || {})
  .filter(([key]) => /^http\.codes\.\d+$/.test(key))
  .map(([key, value]) => ({ code: key.replace("http.codes.", ""), count: value }))
  .sort((a, b) => Number(a.code) - Number(b.code));

const endpointPrefix = "plugins.metrics-by-endpoint.response_time.";
const endpoints = Object.entries(aggregate.summaries || {})
  .filter(([key]) => key.startsWith(endpointPrefix))
  .map(([key, summary]) => {
    const url = key.slice(endpointPrefix.length);
    const codeCounterPrefix = `plugins.metrics-by-endpoint.${url}.codes.`;
    const errors = Object.entries(aggregate.counters || {}).reduce((sum, [k, v]) => {
      return k.startsWith(codeCounterPrefix) && /[45]\d\d$/.test(k) ? sum + v : sum;
    }, 0);

    return { url, ...summary, errors };
  })
  .sort((a, b) => b.count - a.count);

function buildLineChart(
  { width = 760, height = 220, padding = { top: 16, right: 16, bottom: 28, left: 48 } },
  lines,
) {
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxT = Math.max(1, ...series.map((p) => p.t));
  const maxY = Math.max(1, ...lines.flatMap((l) => l.values.map((p) => p.y)));

  const x = (t) => padding.left + (t / maxT) * innerW;
  const y = (v) => padding.top + innerH - (v / maxY) * innerH;

  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const v = (maxY / 4) * (i + 1);
    const yy = y(v).toFixed(1);
    return (
      `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" class="gridline" />` +
      `<text x="${padding.left - 6}" y="${yy}" class="axis-label" text-anchor="end" dominant-baseline="middle">${fmt(v)}</text>`
    );
  }).join("");

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const t = (maxT / 4) * i;
    const xx = x(t).toFixed(1);
    return `<text x="${xx}" y="${height - padding.bottom + 16}" class="axis-label" text-anchor="middle">${fmt(t)}s</text>`;
  }).join("");

  const paths = lines
    .map((line) => {
      const d = line.values
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`)
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="2" />`;
    })
    .join("");

  const legend = lines
    .map(
      (line) =>
        `<span class="legend-item"><span class="swatch" style="background:${line.color}"></span>${escapeHtml(line.label)}</span>`,
    )
    .join("");

  return `
    <div class="chart-legend">${legend}</div>
    <svg viewBox="0 0 ${width} ${height}" class="chart" role="img">
      ${gridLines}
      ${xTicks}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis-line" />
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis-line" />
      ${paths}
    </svg>`;
}

const latencyChart = buildLineChart({}, [
  { label: "p50 (ms)", color: "#22c55e", values: series.map((p) => ({ t: p.t, y: p.p50 })) },
  { label: "p95 (ms)", color: "#f59e0b", values: series.map((p) => ({ t: p.t, y: p.p95 })) },
  { label: "p99 (ms)", color: "#ef4444", values: series.map((p) => ({ t: p.t, y: p.p99 })) },
]);

const rpsChart = buildLineChart({}, [
  { label: "requests/sec", color: "#3b82f6", values: series.map((p) => ({ t: p.t, y: p.rps })) },
]);

const errorChart = buildLineChart({}, [
  {
    label: "errors (4xx/5xx) per interval",
    color: "#ef4444",
    values: series.map((p) => ({ t: p.t, y: p.errors })),
  },
]);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Load test report - ${escapeHtml(appLabel)} (${escapeHtml(environment)})</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 2rem; max-width: 980px; margin-inline: auto;
    background: #f8fafc; color: #0f172a;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1220; color: #e2e8f0; }
    .card, table { background: #131c2e !important; border-color: #24314a !important; }
    .gridline { stroke: #24314a !important; }
    .axis-line { stroke: #46567a !important; }
    .axis-label { fill: #94a3b8 !important; }
    th { color: #94a3b8 !important; border-color: #24314a !important; }
    td { border-color: #1c2740 !important; }
  }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem 1rem; }
  .card .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
  .card .value { font-size: 1.4rem; font-weight: 600; margin-top: 0.2rem; }
  .card.warn .value { color: #dc2626; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 1.05rem; margin-bottom: 0.5rem; }
  .chart { width: 100%; height: auto; display: block; }
  .chart-legend { display: flex; gap: 1rem; font-size: 0.8rem; color: #64748b; margin-bottom: 0.25rem; }
  .legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
  .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .gridline { stroke: #e2e8f0; stroke-width: 1; }
  .axis-line { stroke: #94a3b8; stroke-width: 1; }
  .axis-label { fill: #64748b; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  th, td { text-align: right; padding: 0.5rem 0.75rem; font-size: 0.85rem; }
  th:first-child, td:first-child { text-align: left; }
  th { color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  td { border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
</style>
</head>
<body>
  <h1>Load test report: ${escapeHtml(appLabel)}</h1>
  <div class="meta">
    environment: <strong>${escapeHtml(environment)}</strong> ·
    duration: <strong>${fmt(durationSec)}s</strong> ·
    generated: ${escapeHtml(new Date().toISOString())}
  </div>

  <div class="cards">
    <div class="card"><div class="label">Total requests</div><div class="value">${totalRequests}</div></div>
    <div class="card ${errorRate > 1 ? "warn" : ""}"><div class="label">Error rate</div><div class="value">${fmt(errorRate, 2)}%</div></div>
    <div class="card"><div class="label">Completed VUs</div><div class="value">${completedVusers}</div></div>
    <div class="card ${failedVusers > 0 ? "warn" : ""}"><div class="label">Failed VUs</div><div class="value">${failedVusers}</div></div>
    <div class="card"><div class="label">p50 latency</div><div class="value">${fmt(overallRt.p50)}ms</div></div>
    <div class="card"><div class="label">p95 latency</div><div class="value">${fmt(overallRt.p95)}ms</div></div>
    <div class="card"><div class="label">p99 latency</div><div class="value">${fmt(overallRt.p99)}ms</div></div>
    <div class="card"><div class="label">Max latency</div><div class="value">${fmt(overallRt.max)}ms</div></div>
  </div>

  <section>
    <h2>Latency over time (as load ramps up)</h2>
    ${latencyChart}
  </section>

  <section>
    <h2>Throughput over time (requests/sec)</h2>
    ${rpsChart}
  </section>

  <section>
    <h2>Errors over time</h2>
    ${errorChart}
  </section>

  <section>
    <h2>Status codes</h2>
    <table>
      <thead><tr><th>Code</th><th>Count</th></tr></thead>
      <tbody>
        ${statusCodes.map((s) => `<tr><td>${escapeHtml(s.code)}</td><td>${s.count}</td></tr>`).join("") || '<tr><td colspan="2">No data</td></tr>'}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Per-endpoint breakdown</h2>
    <table>
      <thead>
        <tr><th>Endpoint</th><th>Requests</th><th>Errors</th><th>Mean (ms)</th><th>p95 (ms)</th><th>p99 (ms)</th><th>Max (ms)</th></tr>
      </thead>
      <tbody>
        ${
          endpoints
            .map(
              (e) =>
                `<tr><td>${escapeHtml(e.url)}</td><td>${e.count}</td><td>${e.errors}</td><td>${fmt(e.mean)}</td><td>${fmt(e.p95)}</td><td>${fmt(e.p99)}</td><td>${fmt(e.max)}</td></tr>`,
            )
            .join("") || '<tr><td colspan="7">No per-endpoint data</td></tr>'
        }
      </tbody>
    </table>
  </section>
</body>
</html>
`;

writeFileSync(htmlPath, html);
console.log(`[load-testing] HTML report written to ${htmlPath}`);
