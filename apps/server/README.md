# VeriWorkly API Server

The backend engine for VeriWorkly — a Node/Express + TypeScript API covering auth, documents, Master Profile, AI writing, ATS scoring, profile import, sharing, billing, the Portfolio product, and the affiliate/ambassador programs. PostgreSQL via Prisma, Redis for caching/rate-limiting/counters/locks.

## Requirements

- Node.js 22, PostgreSQL, and **Redis 7 or later** (the in-handler limiters use `EXPIRE … NX`, which Redis 6 rejects).

## 🚀 Quick Start

1. **Install dependencies** (from monorepo root):

   ```bash
   npm install
   ```

2. **Setup environment variables**:
   Create a `.env` file in `apps/server/` (see `.env.example` for the full list, including Dodo Payments and Cloudflare R2 credentials):

   ```env
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://localhost:6379
   AUTH_SECRET=your-secure-secret
   ```

3. **Initialize the Database**:

   ```bash
   npm run db:migrate -w @veriworkly/server
   ```

   On servers run `npm run db:migrate:deploy -w @veriworkly/server` instead. The `db:push` script was removed because it bypasses migrations and leaves the migration history out of step with the database.

4. **Start development server**:
   ```bash
   npm run dev:server
   ```

The API will be available at `http://localhost:8080`.

## 🏗️ Architecture

- **Express.js**: Core API framework, clustered across CPU cores in production via `throng`, with graceful shutdown handling per worker.
- **Prisma ORM**: Type-safe PostgreSQL access. See `prisma/schema.prisma` for the full data model — documents, Master Profile, billing/entitlements/credits, portfolios, affiliate/ambassador, roadmap, usage metrics.
- **Redis**: Session cache, rate-limiting, view-count buffering, and distributed locks for scheduled jobs.
- **Better-Auth**: Passwordless email OTP plus Google/GitHub/LinkedIn OAuth, with account linking and Postgres-backed sessions shared across subdomains.
- **Dodo Payments**: Subscriptions, one-off credit-pack purchases, and a customer billing portal, driven by idempotent webhook processing.
- **Cloudflare R2**: Presigned-URL uploads for portfolio images, with a verify-on-complete step and abandoned-upload garbage collection.

## 📦 What this API actually covers

Beyond auth and core document CRUD (soft-delete only — hard-delete/restore exist at the service layer but aren't routed yet):

- **Master Profile** (`/profiles/master`) — one JSON record per user, no entitlement gating, auto-seeds new documents.
- **ATS Checker** (`/ats`) — a deterministic core scan plus an AI-powered deep-analysis layer sharing one scan-quota bucket, with SSRF-hardened job-description URL fetching.
- **AI writing** (`/ai`) — rewriting, section generation, tailoring, and portfolio copy, dynamically routed across Anthropic Claude and OpenAI GPT models, backed by a two-phase reserve→commit/release credit flow.
- **Profile import** (`/profiles/import/github`, `/profiles/import/linkedin`) — GitHub is real OAuth with a hidden 50/day paid-tier cap protecting the shared API token; LinkedIn is AI-parsed paste/PDF text, not an API integration.
- **Sharing** (`/shares`) — password-protected (scrypt), expiring, revocable public links with view analytics.
- **Billing** (`/billing`) — entitlements and the AI credit wallet as two separate systems, whitelisted checkout, Dodo webhook processing.
- **Portfolios** (`/portfolios`, `/portfolio-assets`) — publish/unpublish, analytics, R2-backed asset uploads.
- **Affiliate & Ambassador** (`/affiliates`, `/ambassador`) — both gated by a boot-time feature-flag (`config.growth.*Enabled`), returning `503` when off. Affiliate is fully live (3-tier commissions, manual payouts); Ambassador covers application intake (`GET /me`, `POST /apply`) plus a full admin review workflow — the rewards/points economy is not built yet.
- **Roadmap** (`/roadmap`) — public read-only roadmap data; writes live under `/admin/roadmap`. Votes/bookmarks/comments have a data model and are read-visible but have no write route.
- **Developer API keys** (`/api-keys`) — HMAC-SHA256-hashed, scoped (including `ai:write`), auto-expiring, force-invalidated within 5 minutes of a subscription lapsing.
- **Admin tools** (`/admin/*`) — one router covering users, ambassadors, affiliates, portfolios, documents, share links, billing, API keys, the audit log, system/ops, and the roadmap + changelog CMS. `adminAuthMiddleware` is applied once at the router root, so every sub-route is gated by construction, and each mutating endpoint requires an audit reason and writes an `AdminAuditEntry`.

## 🔐 Internal server-to-server contract

Server-side callers (studio and portfolio SSR / route handlers, internal jobs) authenticate to the API with one header, `x-internal-key`, compared in constant time against one of two optional secrets. Neither is ever sent to a browser. Each is unset by default (feature off); in production each must be at least 32 characters when set (`openssl rand -hex 32`). They are separate from `INTERNAL_SYNC_API_KEY` (GitHub sync).

| Env var              | Send it when                                                                                                                                  | What it does                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNAL_API_KEY`   | Every server-side fetch made on behalf of a browser request (e.g. `lib/server-fetch.ts`), together with `x-forwarded-client-ip: <browser IP>` | The API uses `x-forwarded-client-ip` as the client IP for rate limiting, quotas, request logs and audit, instead of the SSR host's IP. Without a matching key the header is ignored, so a browser cannot spoof its IP with it. The value must be a bare IPv4/IPv6 address; anything else is ignored. |
| `STATS_INTERNAL_KEY` | `POST /api/v1/stats/events` from a trusted server                                                                                             | Marks the call as internal: no `Origin`/API key needed, `custom_*` event names and `value` (1-1000) are accepted. At most 50 distinct custom names per UTC day; a new name past that gets `429`.                                                                                                     |

Rules the callers can rely on:

- A request matches one key per `x-internal-key` header. A stats call sent with `INTERNAL_API_KEY` is treated as public, and an IP-forwarding call sent with `STATS_INTERNAL_KEY` has its `x-forwarded-client-ip` ignored.
- Public `/stats/events` callers (browser origin or any developer API key, whatever its scopes) may only send the allow-listed event names (`KNOWN_EVENTS` in `src/services/analyticsService.ts`); `value` is ignored and every call counts as 1. An unknown name is `400`.
- The two secrets must differ (production refuses to boot when they are equal), and `AUTH_IP_ADDRESS_HEADERS` may never list `x-forwarded-client-ip` (boot error; the parser also drops it), because better-auth would trust it without the key.
- The forwarded IP wins over `TRUST_PROXY` handling, so only send it with the browser's real address (from the incoming request's trusted proxy headers).

## ⏰ Cron jobs

Five scheduled jobs (`src/jobs/`), each guarded by a Redis distributed lock: GitHub sync (twice daily), portfolio/share view flush (every 10 minutes), usage-metrics flush (daily), portfolio access job (hourly — grace-period suspension plus abandoned-upload cleanup), and changelog release sync (`CHANGELOG_RELEASE_SYNC_CRON`, default daily at 06:00 UTC).

## 🧠 Redis memory and limits

- **Every key the server writes has a TTL**, with one deliberate exception: the view-flush batch ids (`share:views:processing:batch-id`, `portfolio:views:buffer:*:processing:batch-id`), which must survive until their batch commits and are deleted with it. Caches go through `cacheSet` (always `SETEX`); view and usage buffers, dedup markers, rate-limit buckets and locks set `EX`/`PX` or `EXPIRE` when written. Keep it that way for new keys. Known exceptions still to fix: the usage-metrics flush batch id (`analyticsService.ts`) and better-auth secondary-storage writes that arrive without a ttl (`auth/index.ts`).
- **Memory ceiling.** Compose runs Redis with `--maxmemory ${REDIS_MAXMEMORY:-256mb} --maxmemory-policy volatile-lru`. That policy evicts any key with a TTL, not only caches: under memory pressure it can also drop buffered view and usage counts, rate-limit buckets and job locks. Once nothing evictable is left, writes fail with OOM. Size `REDIS_MAXMEMORY` so the working set (caches plus a day of buffers) fits with headroom, and treat evictions in `INFO stats` as a signal to raise it. Sessions survive eviction: better-auth stores them in Postgres too (`storeSessionInDatabase`) and falls back to the database when the Redis copy is gone, so an evicted session costs one extra query, not a sign-out. Evicted better-auth rate-limit buckets (`ba-rl:*`) simply restart their window.
- **Rate limiter.** Each Redis call is bounded by `RATE_LIMIT_REDIS_TIMEOUT_MS` (default 400 ms); past it the request is counted in process memory, and after 3 timeouts in a row the limiter skips Redis for 5 s before trying again, except the fail-closed classes (share verify, contact, OTP), which answer 503. Every 429 carries `Retry-After`, including the AI in-flight cap.
- **Autosave class.** `PATCH /api/v1/documents/:id` and `PUT /api/v1/profiles/master` are limited to 600 per 15 minutes per user, counted after authentication (the IP limiter runs before auth, so it only counts these in the per-IP global bucket). A request that reaches the class without a user is keyed on its IP.
- **JSON bodies** are limited to 100 kb. After authentication, documents, profiles (master profile and imports), share create (`POST /shares`) and the portfolio draft (`PUT /portfolios/draft`) accept 4 MB, and `/ai/*` plus ATS `check`/`analyze`/`convert-resume` accept 256 kb. Larger bodies get 413.

## 📁 Folder Structure

- `src/`: TypeScript source code.
  - `auth/`: Better-Auth configuration and mailers.
  - `jobs/`: Scheduled background tasks.
  - `routes/`: Express route definitions (see `src/routes/` for the full list of route groups). Admin routes live in `routes/admin/`, mounted through a single gated router.
  - `controllers/` / `services/`: Request handling and business logic layers, each with an `admin/` subdirectory mirroring the admin route groups.
  - `validators/`: Zod request schemas, with `validators/admin/` covering the admin surface.
  - `middleware/`: Auth, admin gating, rate limiting, feature flags.
- `prisma/`: Database schema and migrations.

## 📖 Full Documentation

For API reference and database details, visit [docs.veriworkly.com/api-reference](https://docs.veriworkly.com/api-reference).

## 💳 Dodo dashboard checklist

The webhook handler trusts the dashboard for what it cannot see in a payload. Confirm each of these in the Dodo Payments dashboard before enabling payments for customers; a wrong setting here changes what a paying customer receives.

| What                         | Where in the dashboard                                                                                                                          | Must be                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product type per plan        | **Products → (product) → Pricing**                                                                                                              | `ai_credits` monthly/annual, `portfolio_pro` monthly/annual and `bundle` monthly/annual are **recurring** products with `subscription_period_count` equal to the billing frequency (1 month / 1 year). The bundle **3-Day Sprint** (`DODO_PAYMENTS_BUNDLE_ONE_DAY_PRODUCT_ID`), the **7-day pass** (`DODO_PAYMENTS_BUNDLE_SEVEN_DAY_PRODUCT_ID`) and both credit packs are **one-time** products. A pass configured as recurring auto-renews against the copy; a plan configured as one-time never sends `subscription.*` events and only grants credits. |
| Product ids                  | **Products → (product)**                                                                                                                        | Each product's id matches the `DODO_PAYMENTS_*_PRODUCT_ID` variable for that plan and interval; the handler resolves the plan from `product_id` first and only falls back to checkout metadata for an id it does not know.                                                                                                                                                                                                                                                                                                                                |
| Webhook endpoint and secret  | **Developer → Webhooks**                                                                                                                        | Endpoint `https://<api-host>/api/v1/billing/webhooks/dodo`, all `subscription.*` and `payment.*` events subscribed, and the endpoint's signing secret (`whsec_…`) set as `DODO_PAYMENTS_WEBHOOK_SECRET`. Unsigned deliveries are refused in every environment.                                                                                                                                                                                                                                                                                            |
| Return URLs                  | Set per checkout by the API from `DODO_PAYMENTS_CHECKOUT_RETURN_URL`, `DODO_PAYMENTS_CHECKOUT_CANCEL_URL` and `DODO_PAYMENTS_PORTAL_RETURN_URL` | All three are `https://` studio URLs in production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Payout / settlement currency | **Settings → Payouts** (business profile)                                                                                                       | **USD**. Dodo discontinued INR payouts; customers may still pay in INR by UPI. Grants never depend on the settlement currency, so a non-USD settlement is processed and logged at `warn` for an operator to notice.                                                                                                                                                                                                                                                                                                                                       |
| Customer portal plan changes | **Settings → Customer portal**                                                                                                                  | Plan changes and cancellations arrive as `subscription.plan_changed` / `subscription.cancelled`; cancellation keeps access until the paid period ends, which is what the cancellation email promises.                                                                                                                                                                                                                                                                                                                                                     |
