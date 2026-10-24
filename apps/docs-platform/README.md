# VeriWorkly Documentation Platform

The source for [docs.veriworkly.com](https://docs.veriworkly.com). Built with Next.js 16 and
[Fumadocs](https://fumadocs.dev).

## Quick start

From the repository root:

```bash
npm install
npm run dev:docs
```

The docs are served at **http://localhost:3002**.

## Content structure

```
content/
├── docs/                  Hand-written documentation (MDX)
│   ├── meta.json          Sidebar order and section separators
│   ├── getting-started/
│   ├── architecture/
│   ├── product/           Product guides
│   ├── user-guides/
│   ├── operations/
│   ├── contributing/
│   └── legal/
└── api-reference/         Generated from the OpenAPI spec — do not hand-edit
    └── meta.json
specs/                     Source OpenAPI fragments
openapi.yaml               Bundled spec (generated)
```

### Writing documentation

Add or edit an `.mdx` file under `content/docs/`, then register its path in
`content/docs/meta.json`. **Sidebar order comes from `meta.json`, not from the folder structure** —
a page absent from `meta.json` will not appear in the navigation.

Each page needs frontmatter:

```mdx
---
title: Page Title
description: One sentence describing the page. Used for search and social cards.
---
```

Fumadocs UI components (`<Callout>`, `<Cards>`, `<Card>`, `<Accordions>`, `<Steps>`, `<Files>`) are
available without importing them, except `Steps`/`Step` and `Files`/`Folder`/`File`, which are
imported from `fumadocs-ui/components/*`.

### Regenerating the API reference

`content/api-reference/` is generated — only the hand-written `overview.mdx` pages and `meta.json`
files in it are authored by us. Edit the fragments under `specs/`; **generation then happens
automatically**, because `npm run dev` and `npm run build` in this workspace both run
`generate:api` first (via `predev` / `prebuild`). The bundled `openapi.yaml` and the operation
pages can never drift from the spec.

To run it on its own — from this workspace, or from the repository root:

```bash
npm run generate:api
```

That does two things, both in `scripts/generate-api-docs.mjs`:

1. Bundles `specs/openapi.yaml` (plus `specs/paths/*` and `specs/components/*`) into the flat
   `openapi.yaml`, resolving every `$ref` and failing loudly on a broken one.
2. Regenerates one MDX page per operation under `content/api-reference/`. Pages are built in a
   temporary folder first and only the ones that changed are written, so a failed run leaves the
   existing pages alone; pages for operations that no longer exist are removed. It warns when a
   page is missing from its folder's `meta.json`, because that page would not appear in the sidebar.
3. Writes `public/openapi.json` and `public/openapi.yaml`, the served copies of the spec. The other
   apps do not carry a copy: their `/openapi.json` redirects here.

Step 1 replaces `npx @redocly/cli bundle`, which required a network install; the output is
byte-for-byte equivalent.

## Accuracy policy

Documentation here describes shipped behaviour. Before documenting a limit, quota, default, or gate,
verify it against the code — quotas live in `apps/server/src/services/*QuotaService.ts`, plan
definitions in `apps/server/src/services/productCatalog.ts`, configuration defaults in
`apps/server/src/config.ts`, and the data model in `apps/server/prisma/schema.prisma`.

Where behaviour is surprising, partially rolled out, or known-broken, say so in a `<Callout>` rather
than omitting it.

## Live site

[docs.veriworkly.com](https://docs.veriworkly.com)
