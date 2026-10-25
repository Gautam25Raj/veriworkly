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

## ⏰ Cron jobs

Five scheduled jobs (`src/jobs/`), each guarded by a Redis distributed lock: GitHub sync (twice daily), portfolio/share view flush (every 10 minutes), usage-metrics flush (daily), portfolio access job (hourly — grace-period suspension plus abandoned-upload cleanup), and changelog release sync (`CHANGELOG_RELEASE_SYNC_CRON`, default daily at 06:00 UTC).

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
