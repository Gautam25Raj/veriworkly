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

`content/api-reference/` is generated. Edit the fragments under `specs/`, then run from the
repository root:

```bash
npm run generate:api
```

This bundles `specs/openapi.yaml` into `openapi.yaml` and regenerates the reference MDX pages.

## Accuracy policy

Documentation here describes shipped behaviour. Before documenting a limit, quota, default, or gate,
verify it against the code — quotas live in `apps/server/src/services/*QuotaService.ts`, plan
definitions in `apps/server/src/services/productCatalog.ts`, configuration defaults in
`apps/server/src/config.ts`, and the data model in `apps/server/prisma/schema.prisma`.

Where behaviour is surprising, partially rolled out, or known-broken, say so in a `<Callout>` rather
than omitting it.

## Live site

[docs.veriworkly.com](https://docs.veriworkly.com)
