#!/usr/bin/env node
// Orchestrates Artillery load tests across the veriworkly apps.
//
// Usage:
//   node load-testing/run.mjs <app|all> [--environment local|staging|production] [--quick]
//
// Examples:
//   node load-testing/run.mjs server
//   node load-testing/run.mjs all --environment staging
//   node load-testing/run.mjs portfolio --quick
//
// See README.md for the full walkthrough. This wraps `artillery run` plus
// our own render-report.mjs (Artillery's built-in `report` command is
// deprecated/no-op as of 2.x) so you get a JSON + HTML report per run
// without remembering the flags.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Invoke Artillery's JS entrypoint directly with `node` instead of shelling
// out to the `artillery`/`artillery.cmd` wrapper. Overrides are passed as a
// raw JSON string on argv - going through a shell (cmd.exe on Windows, in
// particular) re-tokenizes and mangles quotes/braces in that JSON, so we
// avoid a shell entirely and pass args straight to the child process.
// (artillery's package.json only exposes an `exports` map, not `./package.json`
// or `main`, so we can't require.resolve it - it's this package's own
// devDependency, installed via `npm install` inside load-testing/.)
const artilleryBin = path.join(__dirname, "node_modules", "artillery", "bin", "run");

if (!existsSync(artilleryBin)) {
  console.error(
    `[load-testing] artillery not found at ${artilleryBin}\nRun "npm install" inside load-testing/ first (this package is separate from the root workspace).`,
  );
  process.exit(1);
}

const APPS = ["server", "site", "site-stress", "studio", "portfolio", "blog", "docs"];

const SCENARIO_FILE = {
  server: "server-api.yml",
  site: "site.yml",
  "site-stress": "site-stress.yml",
  studio: "studio.yml",
  portfolio: "portfolio.yml",
  blog: "blog-platform.yml",
  docs: "docs-platform.yml",
};

// Short, low-arrival-rate smoke test - useful to sanity-check a scenario
// file and that the target app is reachable before committing to the full
// ~9-minute ramp profile.
const QUICK_OVERRIDES = JSON.stringify({
  config: {
    phases: [
      { duration: 10, arrivalRate: 1, name: "quick warm up" },
      { duration: 20, arrivalRate: 1, rampTo: 5, name: "quick ramp" },
      { duration: 20, arrivalRate: 5, name: "quick sustain" },
    ],
  },
});

function parseArgs(argv) {
  const args = { targets: [], environment: "local", quick: false, extra: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--environment" || arg === "-e") {
      args.environment = argv[++i];
    } else if (arg === "--quick") {
      args.quick = true;
    } else if (arg === "--overrides") {
      args.extra.push("--overrides", argv[++i]);
    } else if (arg.startsWith("-")) {
      args.extra.push(arg);
    } else if (arg === "all") {
      args.targets.push(...APPS);
    } else {
      args.targets.push(arg);
    }
  }

  return args;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runOne(app, { environment, quick, extra }) {
  const scenarioPath = path.join(__dirname, "scenarios", SCENARIO_FILE[app]);
  const reportsDir = path.join(__dirname, "reports");
  mkdirSync(reportsDir, { recursive: true });

  const stem = `${app}-${environment}-${timestamp()}`;
  const jsonReport = path.join(reportsDir, `${stem}.json`);
  const htmlReport = path.join(reportsDir, `${stem}.html`);
  const dotenvPath = path.join(__dirname, ".env");

  const runArgs = ["run", "--environment", environment, "-o", jsonReport];

  if (existsSync(dotenvPath)) runArgs.push("--dotenv", dotenvPath);
  else
    console.warn(
      `[load-testing] No load-testing/.env found - using scenario defaults / unset env vars. Copy .env.example to .env to configure targets.`,
    );

  if (quick) runArgs.push("--overrides", QUICK_OVERRIDES);
  runArgs.push(...extra, scenarioPath);

  console.log(`\n[load-testing] === ${app} (${environment}) ===`);
  console.log(`[load-testing] node ${artilleryBin} ${runArgs.join(" ")}\n`);

  const runResult = spawnSync(process.execPath, [artilleryBin, ...runArgs], { stdio: "inherit" });

  if (runResult.status !== 0) {
    console.error(`[load-testing] ${app}: artillery run exited with code ${runResult.status}`);
    return { app, ok: false, jsonReport: null, htmlReport: null };
  }

  const renderScript = path.join(__dirname, "render-report.mjs");
  const reportResult = spawnSync(
    process.execPath,
    [renderScript, jsonReport, htmlReport, app, environment],
    { stdio: "inherit" },
  );

  if (reportResult.status !== 0) {
    console.error(`[load-testing] ${app}: HTML report generation failed (JSON report still at ${jsonReport})`);
    return { app, ok: false, jsonReport, htmlReport: null };
  }

  return { app, ok: true, jsonReport, htmlReport };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.targets.length === 0) {
    console.error(
      `Usage: node load-testing/run.mjs <${APPS.join("|")}|all> [--environment local|staging|production] [--quick]`,
    );
    process.exit(1);
  }

  for (const target of args.targets) {
    if (!APPS.includes(target)) {
      console.error(`Unknown app "${target}". Choose from: ${APPS.join(", ")}, or "all".`);
      process.exit(1);
    }
  }

  const results = args.targets.map((app) => runOne(app, args));

  console.log("\n[load-testing] === Summary ===");

  for (const r of results) {
    if (r.ok) console.log(`  ${r.app}: OK -> ${r.htmlReport}`);
    else console.log(`  ${r.app}: FAILED${r.jsonReport ? ` (partial JSON at ${r.jsonReport})` : ""}`);
  }

  if (results.some((r) => !r.ok)) process.exit(1);
}

main();
