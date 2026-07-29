# Portfolio App — Full Audit

Scope: every route, component, feature module, template, lib/store, and config file under `apps/portfolio` (~230 files: app routes/API, dashboard workspace, landing/marketing, pricing/FAQ/templates features, the 4-template rendering engine, lib/store/proxy). Next.js 16, React 19, Tailwind v4, Zustand, GSAP.

Severity: **CRITICAL** (data loss / broken core flow) · **HIGH** (real bug or security gap) · **MEDIUM** (correctness risk, inconsistency, notable UX gap) · **LOW** (polish, code quality, minor optimization).

**Status: all actionable findings below are fixed.** Verified with `vitest run` (30/30 passing, including new coverage), `tsc --noEmit` (0 errors), `eslint .` (0 errors, 3 pre-existing warnings unrelated to this pass), and a clean `next build`.

---

## 1. Critical & high-severity bugs

### 1.1 ✅ FIXED — Contact form and newsletter signup on the Signal template didn't send anything anywhere
`template-library/signal/SignalTemplate.tsx`

`SignalContactForm` and the footer newsletter form both `await`ed a fake delay, wrote the submission to `localStorage` on the **visitor's own browser**, and showed a success state implying the message was received. Nothing was ever transmitted to the portfolio owner.

**Fix applied:** both forms now hand the validated submission to the visitor's own mail client via a pre-filled `mailto:` to the portfolio owner's email (real delivery, no backend required — matching how Atelier/Nimbus/Cipher already handle contact), with the on-device `localStorage` write kept only as a secondary log, and success copy corrected to describe what actually happens ("Opening your email app..."). Both forms are disabled with an explanatory message if the portfolio has no valid contact email. `signal/design.ts` and `signal/design.md` were updated to describe the new (accurate) behavior.

### 1.2 ✅ FIXED — `TemplatePicker`'s premium gating was driven by a field that was never set
`template-library/registry.ts`, `templates/catalog/templates.ts`, `components/dashboard/editor/TemplatePicker.tsx`, `components/dashboard/editor/EditorCommandBar.tsx`, `components/dashboard/settings/PortfolioSettingsWorkspace.tsx`

`TemplateSummary.isPremium` was read from the registry but never set on any entry, so the Template Picker never showed a "PRO" badge or disabled Nimbus/Cipher — while separate hardcoded `templateId === "nimbus" || templateId === "cipher"` checks elsewhere silently blocked publish/save later.

**Fix applied:** `isPremium: true`/`false` is now set explicitly on every registry entry (signal/atelier: `false`; nimbus/cipher: `true`). Added `isPremiumTemplate(templateId)` in `templates/catalog/templates.ts` as the single source of truth, exported through `lib/portfolio.ts`, and both `EditorCommandBar.tsx` and `PortfolioSettingsWorkspace.tsx` now call it instead of duplicating the id-string check. `TemplatePicker.tsx` now correctly shows the PRO badge / disables the two premium templates for non-premium users up front.

### 1.3 ~~One-time "3-Day Sprint" / "7-Day Hunt" passes send the wrong `interval` value~~ — verified, false positive
`components/pricing/BundlePricingSection.tsx`

Checked against the billing backend directly: `apps/server/src/services/productCatalog.ts` defines `CatalogInterval = "one_day" | "seven_day" | "monthly" | "annual"`, and `billingService.ts` maps `"one_day"` → `addDays(eventTime, 3)` — the backend's `one_day` catalog key already grants 3 days, matching the "3-Day Sprint" copy and its $2.99 price exactly. The frontend's `interval=one_day` param is correct as-is; there is no `three_day` enum value to send instead. **No code change made.**

### 1.4 ✅ FIXED — Guest→cloud login merge could silently overwrite newer cloud data with a stale local draft
`store/portfolio-store.ts`, `lib/portfolio-storage.ts`

On login, if a local (guest) draft and a cloud draft both existed and differed, the store unconditionally treated the local copy as authoritative and pushed it to the cloud, with no comparison against the cloud draft's timestamp — a real data-loss path if the cloud draft was actually newer (edited elsewhere, or after publishing).

**Fix applied:** `lib/portfolio-storage.ts`'s cache now stores an `updatedAt` timestamp alongside `slug`/`content` on every save. `loadWorkspace()` in the store now only lets the local draft win when its `updatedAt` is *provably* newer than the cloud draft's; otherwise the cloud draft wins, and if the local cache predates this fix (no timestamp to compare), the cloud draft is kept and the user is shown a message explaining the ambiguous local edits weren't applied — rather than silently guessing. Also fixed while in this file: `updateSlug` now normalizes internally (a future caller can no longer forget to), `loadWorkspace()` has a re-entrancy guard so concurrent calls share one in-flight load instead of racing, and the redundant `analytics: number` field (which could desync from `analyticsData.totalViews`, and was unused everywhere it mattered) was removed. Covered by new tests in `tests/portfolio-store.test.ts` (merge-wins-local, merge-wins-cloud, re-entrancy).

### 1.5 ✅ FIXED — `parsePortfolioContent` crashed on malformed section data, with no guard at its riskiest call site
`lib/portfolio.ts`, `lib/published-portfolio.ts`

`parsePortfolioContent` indexed into `section.type` without checking that each array element was actually an object first — a single `null`/primitive entry (corrupted cloud draft, truncated write) threw and crashed the parse. `published-portfolio.ts`'s fetch (which serves **every public portfolio page**) wasn't wrapped in try/catch either, so this — or any transient backend hiccup — took down a visitor's page with a hard 500.

**Fix applied:** `parsePortfolioContent` now filters out non-object entries from `sections`, `items`, and `socialLinks` before touching their properties, and validates/reshapes `socialLinks` into `{id, label, url}` instead of blindly casting. `getPublishedPortfolio` in `published-portfolio.ts` is now wrapped in try/catch (returns `null` on any failure, which the caller already treats as `notFound()`) and has an 8s `AbortController` timeout so a hung backend can't hang the page render. Covered by new tests in `tests/portfolio-contract.test.tsx` (malformed sections, malformed items, non-object draft, malformed social links).

### 1.6 ✅ FIXED — Broken login link on the Analytics page
`components/dashboard/analytics/PortfolioAnalyticsWorkspace.tsx`

The "Log In" CTA linked to `href="/login"`, a route that doesn't exist in this app (login lives on the separate Studio app).

**Fix applied:** now builds `${siteConfig.links.app}/login?callbackURL=...` and navigates via `window.location.href`, matching the working pattern already used in `EditorCommandBar.tsx`.

### 1.7 ✅ FIXED — No mobile navigation menu on the two public marketing nav bars
`components/Navigation.tsx`, `features/templates/components/TemplatesNavigation.tsx`

Templates/Pricing/FAQ (and the "Start building" CTA) were hidden behind `hidden md:flex`/`hidden sm:inline` with no mobile fallback — phone users had no way to reach them from the nav bar.

**Fix applied:** both navs now render a hamburger button below their breakpoint that opens a `createPortal`-based overlay menu (mirroring the dashboard sidebar's existing mobile-drawer pattern) with all the links plus the "Start building" CTA, closing on link click, backdrop click, Escape, or route change.

### 1.8 ✅ FIXED — Pricing page showed a "payments disabled" banner but left every checkout button clickable
`app/pricing/page.tsx`, `components/pricing/*`, `features/pricing/components/CheckoutButton.tsx`, `features/pricing/components/PriceCard.tsx`

`paymentsBlocked` was computed and shown in a banner but never passed down to the actual checkout buttons, which stayed fully active regardless.

**Fix applied:** `paymentsBlocked` is now threaded through `BundlePricingSection`, `CustomPlansSection`, `ComparisonTable`, and `PriceCard` into `CheckoutButton`, which renders a disabled, grayed-out, non-navigating button (with an explanatory `title`) instead of a live link whenever payments are blocked.

---

## 2. Security

- **✅ FIXED — `app/api/revalidate/route.ts`** — removed the hardcoded `"dev-revalidate-secret"` fallback entirely; the route now fails closed (503) if `PORTFOLIO_REVALIDATE_SECRET` isn't configured, and compares the provided secret using `crypto.timingSafeEqual` over SHA-256 digests (avoids both the timing side-channel and the length-mismatch throw a naive `timingSafeEqual` call would hit).
- **✅ FIXED — Hardcoded admin-email gate duplicated in two places** — extracted into `lib/admin.ts`'s `isAdminUser(user)`, used by both `app/(workspace)/layout.tsx` and `app/pricing/page.tsx` (and the newly-gated `app/og-generator/page.tsx`, see §6). It fails closed: if `ADMIN_EMAIL` isn't set, nobody is treated as an admin, rather than falling back to a hardcoded personal address.
- **✅ FIXED — Inconsistent JSON-LD escaping** — added a shared `<JsonLd data={...} />` component (`components/JsonLd.tsx`) that always escapes `<` before serializing, and replaced all 7 raw `dangerouslySetInnerHTML` JSON-LD blocks across the app (`app/layout.tsx`, `app/page.tsx`, `app/pricing/page.tsx`, `app/templates/page.tsx`, `app/templates/[id]/page.tsx`, `app/faq/page.tsx`, `app/portfolios/[username]/[[...slug]]/page.tsx`) with it.
- **✅ FIXED — `proxy.ts`'s `!path.includes(".")` heuristic** — replaced with `looksLikeStaticAssetPath()`, which only matches when the *final* path segment ends in a dot-extension, so a route or username containing a dot elsewhere in the path is no longer misclassified as a static asset. Covered by new tests in `tests/proxy-middleware.test.ts`.
- **✅ FIXED — `proxy.ts`'s hardcoded login URL** — now built from `siteConfig.links.app` (the same source of truth used elsewhere) instead of a separately hardcoded dev/prod URL pair.
- **✅ FIXED — No `Content-Security-Policy` header** — added to `next.config.ts`: same-origin + first-party `*.veriworkly.com` allowlist for scripts/styles/connect/frames, `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`, `form-action 'self'`, plus `upgrade-insecure-requests` in production. Not nonce-based (would require threading a per-request nonce through 4 independent template renderers and many inline `style={{}}` usages) — `'unsafe-inline'` is kept for script/style, but this still blocks the highest-value vector: loading a `<script src="https://attacker.example/x.js">` from an untrusted origin.
- **✅ FIXED — `components/DraftPreview.tsx`'s anti-copy/devtools-blocking hacks** — removed entirely (context-menu blocking, `Ctrl+C`/`Ctrl+U`/`Ctrl+P`/`F12`/devtools-shortcut interception, `select-none`/`userSelect: none` styling). These were trivially bypassable and only harmed legitimate use (text selection, `Ctrl+F`, screen readers).

## 3. Data integrity & error handling

- **✅ FIXED — `store/portfolio-store.ts` `updateSlug`** — now normalizes internally via `normalizeSlug()` rather than relying on every caller to do it first (the one existing caller, `SettingsForm.tsx`, had its now-redundant normalize call removed).
- **✅ FIXED — No re-entrancy guard on `loadWorkspace`** — added a module-level in-flight promise guard; concurrent calls now share one load instead of racing. Covered by a new test.
- **✅ FIXED — Redundant `analytics: number` state** — removed from the store entirely (it duplicated `analyticsData.totalViews`, was unused by every consumer, and could desync on a failed refetch).
- **✅ FIXED — `lib/portfolio.ts` `socialLinks` shape validation** — `parsePortfolioContent` now filters to actual objects and reshapes each entry into `{id, label, url}` via the existing `text()` sanitizer, instead of blindly casting the array.
- **✅ FIXED — No `AbortController`/timeout on `authenticated-fetch.ts` and `published-portfolio.ts`** — both now apply a timeout (15s client-side fetches, 8s for the public portfolio page fetch) via `AbortController`, without overriding a caller-supplied `signal` if one is ever passed.
- **✅ FIXED — Error boundaries exposing full stack traces to end users** — `app/error.tsx`, `app/(workspace)/editor/error.tsx`, `app/(workspace)/(dashboard)/error.tsx` now only render `error.stack` when `process.env.NODE_ENV !== "production"`; the digest and message (already short/generic) still show for support purposes.
- **✅ FIXED — Test coverage gaps** — added `tests/proxy-middleware.test.ts` (11 tests covering the default-exported `proxy()` middleware's redirect/rewrite/static-asset branching, previously untested) and `tests/portfolio-store.test.ts` (4 tests covering the guest↔cloud merge logic, slug normalization, and the re-entrancy guard). Extended `tests/portfolio-contract.test.tsx` with 4 new cases for malformed `parsePortfolioContent` input (null/primitive sections, malformed items, non-object drafts, malformed social links) — the exact gap that caused §1.5. All 30 tests pass.

## 4. Performance

- **✅ FIXED — `TemplatePicker.tsx` rendering N live iframes at once** — the catalog grid now renders each template's static preview image (`next/image`, using the same `template.image` asset already used elsewhere) instead of a live `/templates/[id]/preview` iframe per card, eliminating N concurrent React app instances mounting simultaneously when the modal opens.
- **`PreviewStage.tsx` + `TemplatePicker` iframe compounding** — resolved as a side effect of the fix above (the picker no longer mounts any iframes).
- **✅ FIXED — OG image routes: no server-side length cap, duplicated logic** — added `lib/og-text.ts`'s `clampOgText()`, applied to every free-text query param (`title`, `description`, `badge`, `name`, `headline`, `bio`, `availability`, `location`, `subdomain`) across `app/api/og/route.tsx`, `app/api/template/signal/og/route.tsx`, and `app/api/template/atelier/og/route.tsx`. (The deeper "factor the shared layout chrome into one helper" refactor was intentionally not done — these are three independently hand-tuned visual designs, and merging their JSX carried real regression risk for a decorative, non-critical feature relative to the value of just closing the resource-abuse gap.)
- **✅ FIXED — Editor autosave with no `beforeunload` warning** — `PortfolioEditorWorkspace.tsx` now warns on tab close/navigation while `isDirty` is true, in addition to the existing 12s autosave interval.

## 5. Code quality / consistency

- **✅ FIXED — Two unrelated `Field` components sharing a name** — `components/dashboard/settings/Field.tsx`'s export renamed to `SettingsField` (its distinct `{label, hint, children}` shape); `components/dashboard/editor/Field.tsx` keeps the `Field` name. All call sites updated.
- **✅ FIXED — Leftover tooling artifact** — removed the stray `/* Hallmark · pre-emit critique: ... */` comment from `PortfolioEditorWorkspace.tsx`.
- **✅ FIXED — Dead commented-out Discord code** — removed from `features/faq/components/SupportSidebar.tsx` (no live Discord server was confirmed to wire up instead).
- **✅ FIXED — `next Link` used for a `mailto:` URL** — `SupportSidebar.tsx`'s email link is now a plain `<a>`.
- **✅ FIXED — Scattered hardcoded premium-template checks** — see §1.2; both call sites now use the shared `isPremiumTemplate()` helper.
- **Verified, not a bug — `"typescript": "^6"` in `package.json`** — checked: TypeScript 6.0.3 is genuinely installed monorepo-wide (root + portfolio + blog-platform + docs-platform + site + studio all pin `^6`; only `apps/server` still pins `^5.9.3`). Not a typo. No change made.
- **Not changed — `lib/backend.ts`'s `firstPartyServerHeaders` header-casing edge case** — no caller currently passes a differently-cased `Origin` header; left as a documented, low-priority fragility rather than adding defensive code for a scenario that can't currently occur.

## 6. SEO / metadata

- **✅ FIXED — `/og-generator` was fully public, unauthenticated, and indexable** — split into a server `page.tsx` (which now carries `robots: { index: false, follow: false }` metadata and gates access behind the same `isAdminUser` check used by the rest of the internal workspace in production) and a new `OgGeneratorClient.tsx` client component holding the original UI. `app/robots.ts` also now disallows `/og-generator` for defense-in-depth.
- **✅ FIXED — `app/manifest.json` had maskable-only icons** — added `purpose: "any"` entries alongside the existing `purpose: "maskable"` ones for both the 192×192 and 512×512 icons (same files, standard PWA dual-listing practice), so platforms that don't handle maskable-only icons well have a fallback.
- **`app/portfolios/[username]/[[...slug]]/page.tsx` metadata** — reviewed, no changes needed.

## 7. Accessibility

- **✅ FIXED — Missing mobile nav** — see §1.7; keyboard/assistive-tech users on narrow viewports can now reach primary navigation.
- **✅ FIXED — `DraftPreview.tsx` copy/select/context-menu blocking** — removed; see §2.
- Section headings in the template library already used real `<h2>`/`<h3>` tags in document order — no change needed.

## 8. Design/UX

- **✅ FIXED — `WorkspaceNotice.tsx` had no auto-dismiss or close button** — now auto-dismisses after 8s and has a dismiss button, both calling the store's `setMessage("")`.
- **✅ FIXED — Slug input had no inline format guidance** — `SettingsForm.tsx` now shows "Lowercase letters, numbers, and hyphens only." beneath the subdomain field.
- The dashboard/editor experience and the four templates' visual distinctiveness were already strong — no changes needed there.

---

## Verification

- `npx vitest run` — **30/30 passing** (4 new test files/additions: `tests/proxy-middleware.test.ts`, `tests/portfolio-store.test.ts`, plus new cases in `tests/portfolio-contract.test.tsx`).
- `npx tsc --noEmit` — **0 errors**.
- `npx eslint .` — **0 errors**, 3 pre-existing warnings unrelated to this pass (two `<img>` LCP hints in template renderers using arbitrary user-uploaded CDN URLs, one ref-cleanup timing nitpick in Cipher's easter-egg timers).
- `npx next build` — clean production build, all 25 routes compile.
