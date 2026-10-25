# Environment Variables Configuration

VeriWorkly uses a multi-app monorepo structure where each application and the root workspace define specific `.env.example` templates.

---

## 🔑 Workspace Environment Configurations

### 1. Root (`.env`)

The root `.env.example` lists shared frontend values (`SITE_URL`, `NEXT_PUBLIC_BACKEND_URL`, `BACKEND_INTERNAL_URL`, `ADMIN_EMAIL`, `AUTH_SECRET`). `.env.docker.example` is the template for the variables `compose.yaml` interpolates.

### 2. Backend Server (`apps/server/.env`)

The server validates its environment at boot and refuses to start in production when a variable is missing or unsafe. The variables, their defaults and the production rules are documented in one place, next to the code:

- [`apps/server/.env.example`](apps/server/.env.example): every variable, with comments.
- [`apps/server/README.md`](apps/server/README.md): setup, migrations, Redis and database sizing.

### 3. Builder Studio (`apps/studio/.env`)

- `SITE_URL`: Marketing site base URL (default: `http://localhost:3000`).
- `NEXT_PUBLIC_BACKEND_URL`: Public API endpoint for browser calls (default: `http://localhost:8080/api/v1`).
- `BACKEND_INTERNAL_URL`: Server-side API endpoint for Next.js SSR requests (default: `http://localhost:8080/api/v1`).
- `NEXT_PUBLIC_APP_URL`: Public origin of the studio, used for Open Graph image URLs (default: `http://localhost:3001`).
- `ADMIN_EMAIL`: Matches server admin email for admin UI surfaces.
- `AUTH_SECRET`: Matches server auth secret.

### 4. Marketing Site (`apps/site/.env`)

- `NEXT_PUBLIC_SITE_URL`: Canonical public origin, no trailing slash (default: `https://veriworkly.com`; `http://localhost:3000` in development). Build-time. The other apps' addresses (app, docs, blog, portfolio) are not variables: `config/site.ts` resolves them for local and production.
- `NEXT_PUBLIC_BACKEND_URL`: Public API endpoint the browser calls (default: `http://localhost:8080/api/v1`). Build-time.
- `BACKEND_INTERNAL_URL`: API endpoint the server-side render calls; in Docker the service name (`http://api:8080/api/v1`). Runtime.
- `AFFILIATE_PROGRAM_ENABLED`, `AMBASSADOR_PROGRAM_ENABLED`: Growth-program flags, read at runtime and re-read every 5 minutes. Default on in development and off in production; keep them equal to the API's flags.
- `ERROR_REPORT_URL` (optional): Endpoint that receives server-side errors as plain JSON. Runtime.
- `NEXT_PUBLIC_VITALS_URL` (optional): Endpoint that receives real-user Web Vitals as plain JSON. Build-time.

### 5. Portfolio Builder (`apps/portfolio/.env`)

- `SITE_URL`: Public origin for portfolio app (default: `http://localhost:3004`).
- `NEXT_PUBLIC_APP_URL`: Public origin of the portfolio app, used for Open Graph image URLs (default: `http://localhost:3004`).
- `NEXT_PUBLIC_BACKEND_URL`: Public API endpoint (default: `http://localhost:8080/api/v1`).
- `BACKEND_INTERNAL_URL`: Server-side API endpoint (default: `http://localhost:8080/api/v1`).
- `ADMIN_EMAIL`: Admin email for checkout/publish staging gate bypass.
- `PORTFOLIO_REVALIDATE_SECRET`: Secret token for Next.js on-demand ISR revalidation.

### 6. Documentation Platform (`apps/docs-platform/.env`)

- `SITE_URL`: Docs origin URL (default: `http://localhost:3002`).
- `NEXT_PUBLIC_BACKEND_URL`: Public API endpoint (default: `http://localhost:8080/api/v1`).
- `BACKEND_INTERNAL_URL`: Server-side API endpoint (default: `http://localhost:8080/api/v1`).
- `ALLOWED_ORIGINS`: Allowed origins for API proxy.

### 7. Blog Platform (`apps/blog-platform/.env`)

- `SITE_URL`: Blog origin URL (default: `http://localhost:3003`).
- `NEXT_PUBLIC_BACKEND_URL`: Public API endpoint (default: `http://localhost:8080/api/v1`).
- `BACKEND_INTERNAL_URL`: Server-side API endpoint (default: `http://localhost:8080/api/v1`).

---

## 📚 Complete Operations Reference

For exhaustive configuration parameters, defaults, and deployment guides, visit:
[Environment Variables Guide - VeriWorkly Docs](https://docs.veriworkly.com/docs/operations/environment-variables)
