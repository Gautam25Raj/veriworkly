# VeriWorkly Marketing Site

The public-facing marketing site for VeriWorkly (veriworkly.com). Built with Next.js 16 and Tailwind CSS 4.

## 🚀 Quick Start

1. **Install dependencies** (from monorepo root):

   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev:site
   ```

The site will be available at `http://localhost:3000`.

## 🏗️ Architecture

- **Next.js 16 (App Router)**: Optimized for SEO and performance.
- **Tailwind CSS 4**: Modern styling utilizing the shared design system in `@veriworkly/ui`.
- **Framer Motion**: Smooth animations and transitions.

## 📄 What's on this site

Beyond landing, pricing, features, how-it-works, and FAQ:

- **`/affiliate`** and **`/ambassador`** — marketing pages for both growth programs. Both programs are gated in the product itself by a boot-time feature flag (`config.growth.affiliateProgramEnabled` / `ambassadorProgramEnabled`), default-off in production until explicitly enabled.
- **`/security`** — a real responsible-disclosure policy plus a "what data lives where" breakdown.
- **`/stats`** — a public live board of the VeriWorkly GitHub repo's own dev activity.
- **`/style-guide`** — a public showcase of the shared design system, the public counterpart to `packages/ui`.
- **`/roadmap`** and subpages — fully backend-driven from the same data admins manage in Studio.
- **`/templates`** — a resume/cover-letter template showcase (distinct from the Portfolio app's own template gallery).
- **`/og-generator`** — an internal Open Graph tool, excluded from search indexing.
- **An "AI answer engine" content layer** — `public/llms.txt` and `public/pricing.md` are machine-readable summaries of the product aimed at AI crawlers and chat assistants; `robots.ts` explicitly allowlists `GPTBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, and `CCBot`. Treat these two files as the canonical, human-maintained source of truth for pricing/product facts — other surfaces (FAQ copy, other apps' pricing pages) should be reconciled against them, not the other way around.

## 📁 Folder Structure

- `app/`: Next.js routes and layouts.
- `components/`: UI components (Hero, Features, Pricing, etc.).
- `features/`: Domain-specific marketing logic (affiliate, ambassador, pricing, FAQ, roadmap, stats, style guide).
- `public/`: Static assets, OG images, and the `llms.txt`/`pricing.md` AI-crawler content layer.
