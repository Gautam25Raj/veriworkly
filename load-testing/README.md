# Load testing

Load tests every app in the monorepo (`server`, `site`, `studio`, `portfolio`,
`blog-platform`, `docs-platform`) with [Artillery](https://www.artillery.io/),
ramping traffic from a quiet baseline up to a simulated peak/spike so you can
see how each app actually behaves as user load increases - request latency
(p50/p95/p99), throughput, error rate, and where it starts to fall over -
rather than just "does it work at 1 request."

This is a **standalone package**, separate from the main app's npm
workspaces. It has its own `package.json`/`node_modules`/lockfile, is not
listed in the root `package.json` `workspaces`. The scenarios are tracked in git;
`node_modules`, `.env` and generated reports (`reports/*`, except `.gitkeep`) are
ignored via the root `.gitignore`. It never ships with the app or affects the main
app's dependency tree.

## Layout

```
load-testing/
  package.json         this package's own manifest (artillery lives here, not in the root app)
  .env.example        copy to .env and fill in target URLs
  scenarios/           one Artillery config per app
    server-api.yml
    site.yml
    studio.yml
    portfolio.yml
    blog-platform.yml
    docs-platform.yml
  processors/
    helpers.cjs         small JS helpers used by the scenarios (random test
                         data, response-status counters)
  run.mjs                orchestrator: runs a scenario, writes a JSON report,
                         then renders it to HTML
  reports/               generated reports land here (gitignored except .gitkeep)
  fixtures/              small input files (resume.pdf for the ATS extract scenario)
```

## One-time setup

```
cd load-testing
npm install
cp .env.example .env
```

Fill in `load-testing/.env`:

- The `LOCAL_*_URL` vars already match the ports in the root `package.json`
  `dev:*` scripts, so local testing works out of the box.
- `PORTFOLIO_TEST_USERNAME` / `BLOG_TEST_SLUG` are optional but recommended -
  without them, the portfolio-page and blog-post scenarios just exercise the
  404 path instead of a real page render.
- `STAGING_*_URL` / `PRODUCTION_*_URL` only need to be filled in if you intend
  to point `--environment` at those environments (see "Testing against
  staging/production" below).

Artillery is this package's own devDependency (installed by the `npm install`
above, into `load-testing/node_modules`) - it is not part of the root app's
dependencies.

## Running a test

Start whichever app(s) you want to test, then from inside `load-testing/`:

```
npm run loadtest:server
npm run loadtest:site
npm run loadtest:studio
npm run loadtest:portfolio
npm run loadtest:blog
npm run loadtest:docs

npm run loadtest:all        # every app, one after another
```

These call `node run.mjs <app>` under the hood, which:

1. runs the matching `scenarios/<app>.yml` against `--environment local`,
2. writes a JSON report to `load-testing/reports/`,
3. renders that JSON to a standalone HTML report (open it in a browser - it
   has latency-over-time and RPS-over-time charts per scenario/phase).

Pass flags through npm with `--`:

```
npm run loadtest:server -- --environment staging
npm run loadtest:portfolio -- --quick     # ~1 min smoke test instead of ~9 min
```

Or call the orchestrator / Artillery directly (still from inside `load-testing/`):

```
node run.mjs server --environment local
npx artillery run --dotenv .env --environment local scenarios/server-api.yml
```

## What "increasing user load" means here

Every scenario file uses the same phase shape, meant to look like a real
traffic day rather than a flat hammer test:

| Phase                | What it simulates                               |
| -------------------- | ----------------------------------------------- |
| Warm up              | trickle of traffic                              |
| Ramp to typical load | traffic building up (morning ramp)              |
| Sustained typical    | steady-state normal usage                       |
| Ramp to peak load    | traffic climbing toward a busy period           |
| Sustained peak       | busiest normal period you'd expect in prod      |
| Spike + spike hold   | a sudden burst (launch, HN/PH front page, etc.) |
| Cool down            | traffic draining back off                       |

Each phase's arrival rate (new virtual users/sec) is intentionally higher
than the last, so the HTML report shows latency and error rate _as a function
of load_, not just an average - that's what tells you where a given app's
ceiling actually is.

Tune the numbers in a scenario's `config.phases` block directly if your
prod traffic is meaningfully bigger/smaller than the defaults, or use
`--overrides '{"config":{"phases":[...]}}'` to override per-run without
editing the file.

## Reading the results

After a run, open the `.html` file printed at the end (or check
`load-testing/reports/`). Key numbers per scenario/overall:

- **p95 / p99 response time** - the number that matters more than the mean;
  it's what your slowest-but-still-common requests look like.
- **Requests completed vs timed out/errored** - `errors.ETIMEDOUT`,
  non-2xx status codes broken out by code.
- **RPS achieved vs RPS requested** - if achieved falls behind requested
  during the peak/spike phases, the app (or its DB/Redis/upstream) is the
  bottleneck, not the load generator.
- **`custom.status_*` counters** - emitted by `processors/helpers.cjs` for
  every 4xx/5xx response, so you can see exactly when errors started
  appearing relative to load.

A reasonable bar for "prod ready" (adjust to your own SLOs): p95 latency
stays flat (not climbing) through "Sustained peak," error rate stays ~0
outside the "Spike"/"Spike hold" phases, and the app recovers (latency drops
back down) during "Cool down" rather than staying degraded.

## Important caveats

**Rate limiting is disabled in dev.** `apps/server/src/middleware/rateLimit.ts`
short-circuits entirely when `NODE_ENV === "development"`. If you run
`server-api.yml` against a plain `npm run dev:server`, you will not see 429s
even at the "Spike" phase - that's expected, not a finding. To actually
validate rate-limit behavior under load, run the server with
`NODE_ENV=production` (after `npm run build:server`) locally, or point
`--environment` at staging/production.

**`next dev` is not representative of prod.** All five frontend apps run
unoptimized dev servers by default (on-demand compilation, no production
bundle, React dev overhead). For latency numbers you'd actually trust,
build and start each app first:

```
npm run build:site      && npm run start -w @veriworkly/site      -- -p 3000
npm run build:studio    && npm run start -w @veriworkly/studio    -- -p 3001
npm run build:docs      && npm run start -w @veriworkly/docs-platform -- -p 3002
npm run build:blog      && npm run start -w @veriworkly/blog-platform -- -p 3003
npm run build:portfolio && npm run start -w @veriworkly/portfolio  -- -p 3004
```

**Default scenarios are unauthenticated on purpose.** They only hit public
routes (health checks, public portfolio listing, marketing pages, login
page, etc.) so they run with zero setup and never touch billing/AI/email
side effects. Notably excluded: `/api/v1/ai/generate`, `/api/v1/ats/*`
(costs OpenAI tokens per call), `/api/v1/contact` (sends real email, and is
rate-limited to 5/hour anyway), `/api/v1/billing/*` (hits Dodo Payments),
`/api/v1/profiles/import/*` (hits GitHub/LinkedIn).

To add an authenticated scenario (e.g. dashboard load in `studio`, or
`/api/v1/portfolios/me` in `server`):

1. Log in once in a browser against the target environment, grab the
   session cookie (or mint an API key via `/api/v1/api-keys`).
2. Put it in `load-testing/.env` as `AUTH_COOKIE` / `AUTH_API_KEY`.
3. Add a scenario to the relevant `.yml` with:
   ```yaml
   - name: "Authenticated dashboard"
     flow:
       - get:
           url: "/api/v1/portfolios/me"
           headers:
             cookie: "{{ $processEnvironment.AUTH_COOKIE }}"
   ```
   Keep the weight/volume modest - you're now testing with one shared
   session across many virtual users, which isn't a realistic multi-user
   simulation, just a way to exercise the authenticated code path under load.

## Testing against staging/production

Fill in the `STAGING_*_URL` / `PRODUCTION_*_URL` values in `.env`, then:

```
npm run loadtest:server -- --environment staging
```

Treat production runs with real caution:

- Confirm with whoever owns infra/on-call before running anything above
  `--quick` against production - this is a real traffic generator and will
  show up in your metrics/alerts.
- Start with `--quick` to confirm the target and scenario are correct before
  committing to the full ~9-minute ramp.
- Never point authenticated scenarios at production with anything but a
  dedicated test account.

## Server API scenarios (`scenarios/server-api.yml`)

Beyond the unauthenticated GETs, the server scenario covers the paths that hurt under load:

| Scenario          | Endpoint                                    | Needs                                                 |
| ----------------- | ------------------------------------------- | ----------------------------------------------------- |
| Document autosave | POST, 10x PATCH, DELETE `/documents`        | `SESSION_COOKIE`                                      |
| Public share read | GET `/shares/public/:username/:slug`        | `SHARE_USERNAME`, `SHARE_SLUG` (else 404 path)        |
| ATS extract       | POST `/ats/extract` (`fixtures/resume.pdf`) | nothing (anonymous quota applies)                     |
| Admin overview    | GET `/admin/overview`                       | `ADMIN_SESSION_COOKIE` (or an admin `SESSION_COOKIE`) |

Scenarios whose variable is unset skip their authenticated steps instead of failing.

### Running against staging

Never run this against production. Use a staging deployment with its own database and a dedicated
test account, then from `load-testing/`:

```
export TARGET=https://api.staging.example.com   # server base URL, no trailing slash
export ORIGIN=https://studio.staging.example.com # an origin the server's CORS/CSRF allows
export SESSION_COOKIE='better-auth.session_token=...'  # full Cookie header of the test account
export API_KEY=                                   # optional; sent as X-API-Key when set
export SHARE_USERNAME=... SHARE_SLUG=...          # optional, a real published share link
npm run loadtest:server -- --environment target --quick   # smoke first, then drop --quick
```

`ORIGIN` defaults to `http://localhost:3001` and is sent on every request, including GETs. The
autosave rate limit (and ATS extract quota) will return 429 under load; those show up as
`custom.status_429` and are the limiter working, not a finding, unless they appear at low rates.

### What to record per run

- p50/p95/p99 per endpoint class (health, public read, share read, autosave, ATS extract, admin
  overview) and the error/429 counts, from the HTML report.
- Postgres: run `pg_stat_statements_reset()` before the run, then save the top 20 statements by
  `total_exec_time` and by `calls`, and connection counts by state from `pg_stat_activity`.
- Redis: `INFO` (`used_memory`, `instantaneous_ops_per_sec`, `connected_clients`,
  `evicted_keys`, keyspace) before, at peak and after; `INFO commandstats` for the busiest commands.
- Server process: event-loop lag and RSS if available (`/api/v1/health/metrics`).
- Compare against the previous run's JSON report in `reports/`.
