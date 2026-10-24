# VeriWorkly Marketing Site

The public-facing marketing site for VeriWorkly ([veriworkly.com](https://veriworkly.com)). Built with Next.js 16 (App Router), React 19, and Tailwind CSS 4.

## 🚀 Quick Start

1. **Install dependencies** (from monorepo root - this is a workspace, per-app installs will not resolve `@veriworkly/ui`):

   ```bash
   npm install
   ```

2. **Copy the environment file** and configure your values (see `.env.example` for details):

   ```bash
   cp .env.example .env
   ```

3. **Start development server**:

   ```bash
   # from the monorepo root
   npm run dev:site
   # or from apps/site
   npx next dev
   ```

The site runs on `http://localhost:3000`. Sibling apps have fixed dev ports that `config/site.ts` hardcodes for local link resolution: Studio `3001`, Docs `3002`, Blog `3003`, Portfolio `3004`, and Server `8080`. If you change one, update `links` in `config/site.ts` too or cross-app navigation breaks in local dev.

## 🏗️ Architecture

- **Next.js 16 (App Router)** - Marketing pages are prerendered. `/roadmap` and its three status pages prerender and revalidate weekly, and render per request if a roadmap column failed to load (`connection()`). Release pages (`/changelog/[id]`) and roadmap items prerender when the backend answers and render on demand when it does not; an outage never bakes a 404. `/changelog`, `/stats`, `/affiliate`, `/ambassador` (program flags are read per request) and `/ambassador/apply` render per request. `/api/og` is a Node.js route. `/pricing` revalidates every 12 hours.
- **Tailwind CSS 4** - Styling via the shared design system in `@veriworkly/ui` (`transpilePackages`, plus `@source` in `globals.css` so the UI package's classes survive the content scan).
- **Motion** - CSS first: entrances use `.hero-rise` and the scroll-driven `.reveal`, scroll-linked drift uses `.scroll-shift` (`animation-timeline: view()`), and the navbar is plain CSS. Framer is loaded only on the pages that still animate with it, each wrapped in `<MotionIsland>` (`providers/motion-island.tsx`: `LazyMotion` with `domAnimation`, `strict`, and `MotionConfig reducedMotion="user"`). Components use `m.*`, never `motion.*`; `tests/contracts/motion-islands.contract.test.ts` enforces both. A `requestAnimationFrame` loop must stop when there is nothing to move (see `components/ui/parallax-floating.tsx`).
- **Strict CSP & Security Headers** - `next.config.ts` enforces a strict Content-Security-Policy. `connect-src` is an explicit allowlist (`'self'`, the origins of `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_VITALS_URL`, `https://*.veriworkly.com`). Security headers also enforce HSTS, `nosniff`, `same-origin-allow-popups` (COOP), `same-site` (CORP), and frame restrictions. Any new third-party client-side API endpoint must be explicitly added to `connectSrc` in `next.config.ts`.

## 📄 What's on this site

- **Landing & Product Pages**: `/` (homepage), `/features`, `/how-it-works`, `/pricing`, `/about`, `/contact`, and `/faq`.
- **ATS Checker**: `/ats-checker` and `/ats-checker/scan` - the scan runs on the server (`POST /ats/check`, with `/ats/extract` for uploads); the `/ats-engine` page demos the open-source engine in the browser.
- **Templates Gallery**: `/templates` and `/templates/[docType]/[templateId]` - showcase of ATS-optimized resume, cover letter, and portfolio layouts.
- **Competitor Comparison**: `/compare` and `/compare/[tool]` - objective comparison pages with feature matrices against Rezi, Teal, Kickresume, Novoresume, Zety, and Enhancv (backed by `@/features/compare`).
- **Brand Kit**: `/brand-kit` - brand assets, color token swatches, typography showcase, and downloadable `veriworkly-brand-kit.zip`.
- **Changelog**: `/changelog` and `/changelog/[id]` - public release notes, version history, and GitHub contributor integrations.
- **Public Roadmap**: `/roadmap` and subviews (`/roadmap/todo`, `/roadmap/in-progress`, `/roadmap/done`, `/roadmap/[id]`) - synced with the administrative Studio board.
- **Dev Stats**: `/stats` - live repository metrics and activity board.
- **Growth Programs**: `/affiliate` and `/ambassador` (with `/ambassador/apply`) - gated by runtime feature flags (`AFFILIATE_PROGRAM_ENABLED`, `AMBASSADOR_PROGRAM_ENABLED`).
- **Legal & Security**: `/security` (responsible disclosure and data storage breakdown), `/privacy`, and `/terms`.
- **Open Graph Generator**: `/api/og` - dynamic Open Graph card generator backing share cards across all pages.
- **Machine-Readable / AI Search Layer**:
  - `public/llms.txt` (llmstxt.org link format) and `public/pricing.md`; `app/llms-full.txt/route.ts` serves llms.txt plus the FAQ, templates, comparisons and pricing.md as one static file. Both are linked from `<head>`.
  - `public/.well-known/agent.json` - a VeriWorkly-specific discovery document (not an A2A AgentCard).
  - `public/.well-known/security.txt` - RFC 9116 security reporting contact.
  - `/openapi.json` - redirects to `https://docs.veriworkly.com/openapi.json`, the one generated copy of the backend API specification.
  - `app/robots.ts` - every crawler may read the whole site. `next.config.ts` `htmlLimitedBots` adds the AI crawlers to Next's list, so they get `<title>` in `<head>` on streamed routes.
  - `app/sitemap.ts` - static routes plus releases and roadmap items. At build with the backend down it lists static routes only; at runtime a failed fetch throws so ISR keeps the last good sitemap. Closed programs are left out.

## ✅ Content Accuracy Contract

This site makes pricing, quota, and capability claims that are also enforced in code elsewhere in the monorepo. When those drift, the site publishes false information - including into structured data (JSON-LD) that search engines and LLMs quote back at users. Reconcile **downward**, never upward:

1. **`apps/server/src/services/productCatalog.ts`** - the single source of truth for products, prices (in cents), and credit allowances.
2. **`apps/server/src/services/ats/quota.ts`** and **`profileImportQuotaService.ts`** - source of truth for ATS scan and import quotas.
3. **`public/pricing.md`**, **`public/llms.txt`**, and **`public/.well-known/agent.json`** - machine-readable docs that must match (1) and (2).
4. **Site UI Copy & JSON-LD**: `features/pricing/**`, `features/faq/data/faqItems.ts`, `features/landing/faq/data/faqItems.ts`, `features/compare/**`, and schema blocks in `app/layout.tsx`, `app/(marketing)/page.tsx`, and `app/(marketing)/pricing/page.tsx`.

### Known Gotchas When Editing Copy

- **The `one_day` billing interval is the 3-day Sprint Pass.** `billingService.ts` grants `addDays(eventTime, 3)`. Do not "fix" the label to 1 day; ensure provider billing periods match 3 days.
- **Paid GitHub import is capped** at `PAID_GITHUB_IMPORT_DAILY_LIMIT` (50/day) to protect the shared server token. Never write "unlimited" or "unmetered"; `claims-truth.contract.test.ts` fails on both.
- **Payments are closed** (`PAYMENTS_BLOCKED` in `app/(marketing)/pricing/page.tsx`). `pricing.md` and `llms.txt` must say so while it is true; the claims test checks both directions.
- **The free tier has zero AI writing credits.** Do not use "generate", "AI-tailored", or similar for free-tier copy. LinkedIn import is AI-parsed, so verify entitlements before describing features as free.
- **Portfolio publishing is free on core templates, paid on premium ones.** Nimbus and Cipher require a subscription; Signal and Atelier publish free with a "Built with VeriWorkly" badge. Document exports (PDF/DOCX) never carry watermarks on any tier.
- **AI model names are not hardcoded.** They resolve at runtime via `env:VAR` indirection (`apps/server/src/services/aiPrivateConfig.ts`). Prefer capability-based phrasing over specific model names that can become stale.
- **Competitor comparison pricing claims.** `features/compare/data/competitors.ts` includes `PRICING_VERIFIED_AT`. Re-verify live vendor pricing before bumping this date.

## ♿ Accessibility Baseline

Target is **WCAG 2.2 Level AA**:

- `AppShell` (`@veriworkly/ui`) provides the single `<main>` landmark. Page components render into it - do not nest another `<main>`.
- Modal/overlay focus management uses `hooks/use-focus-trap.ts` (handles focus trapping, focus restoration, Escape key, and body scroll locking).
- **Interactive elements**: Anything clickable must be a `<button>` or `<a>`. Disclosure widgets must include `aria-expanded` and `aria-controls`.
- **Labels**: Icon-only controls must have an `aria-label`; icons take `aria-hidden="true"`. Form inputs must have an explicit `<label>` or `aria-label`.
- **Decorative mockups**: Hero preview cards and bento cards containing demo data must include `aria-hidden="true"` and avoid heading tags (`<h1>`-`<h6>`) that corrupt the document outline.
- **Color contrast**: Tokens in `themes.css` are calibrated to WCAG AA contrast (4.5:1 for normal text, 3:1 for large text). Avoid raw ad-hoc `zinc-*`/`gray-*` classes that bypass theming. Filter chips and toggles must use `aria-pressed` or `aria-selected` rather than color alone.

## 📁 Folder Structure

- `app/` - Next.js App Router pages, marketing route group `(marketing)/`, layouts, `robots.ts`, `sitemap.ts`, and `/api/og`.
- `components/` - Shared UI components (layout, navbar, footer, marketing primitives, brand swatches, roadmap kanban).
- `config/` - Static configuration:
  - `brand.ts` - Color tokens, palette metadata, brand download assets.
  - `site.ts` - Canonical URLs, external links, navigation structure, legal contacts.
  - `templates.ts` - Resume, cover letter, and portfolio template catalog summaries.
- `features/` - Domain modules (`landing`, `ats-checker`, `compare`, `pricing`, `roadmap`, `changelog`, `templates`, `stats`, `faq`, `about`, `legal`, `affiliate`, `ambassador`).
- `hooks/`, `providers/`, `utils/`, `lib/` - Client hooks (`useMediaQuery`, `useFocusTrap`, etc.), theme/motion providers, JSON-LD schema helpers, metadata builders, and API fetch wrappers.
- `scripts/`:
  - `check-design-tokens.mts` - Validates token consistency across `themes.css`, `brand.ts`, and `DESIGN.md`.
  - `build-brand-kit.mts` - Generates the downloadable `veriworkly-brand-kit.zip` bundle (`--check` compares instead of writing).
  - `measure-js.mts` - gzipped initial JS per prerendered route.
  - `lighthouse-mobile.mts` - Lighthouse mobile on the six audited pages; the Site Lighthouse workflow posts both tables on pull requests.
- `tests/`:
  - `tests/contracts/` - Automated contract tests ensuring pricing claims, ATS quotas, changelog markdown parsing, and competitor data remain synchronized.
- `public/` - Static images, logos, templates previews, and the machine-readable discovery layer (`llms.txt`, `pricing.md`, `.well-known/agent.json`, `.well-known/security.txt`, `openapi.json`).

## 🔍 Validation & Scripts

Run these commands to validate site integrity:

```bash
# Contract tests: claims vs server constants (prices, quotas, rates, import limit), false-claim
# phrases, metadata lengths, links and redirects, llms.txt links, endpoint query keys vs server
# schemas, build without the backend, motion islands, flags read per request
npm run test:contracts

# Initial JS per prerendered route (after next build) and Lighthouse mobile on six pages
npx tsx scripts/measure-js.mts
npm run lighthouse:mobile -- http://localhost:3100

# Fail if public/brand/veriworkly-brand-kit.zip is stale (runs in CI)
npm run check:brand-kit

# Design token verification (themes.css, brand.ts, DESIGN.md)
npm run check:design

# Build brand kit asset archive (runs automatically in prebuild)
npm run build:brand-kit

# Code quality & formatting
npm run lint
npm run format
npm run format:write

# Production build
npm run build
```

`sitemap.ts` and the roadmap/changelog services fetch from the backend at build time and gracefully fall back to static definitions if the backend is unreachable during build.
