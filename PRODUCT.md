# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers, independent professionals, developers, designers, and founders creating career documents and public portfolios. They work inside focused editors and expect immediate visual feedback, reliable exports, optional cloud sync, and clear control over their data.

## Product Purpose

VeriWorkly is a privacy-first career workspace for building resumes, cover letters, and public portfolios. It should help users turn verified career facts into clear professional writing without obscuring what changed, consuming credits unexpectedly, or locking their source data into the service.

## Positioning

- Free to build and free to export, in every format (PDF, DOCX, Markdown, HTML, plain text, JSON), with no watermark and no account needed to start.
- One Master Profile holds the career facts; every resume, cover letter and portfolio takes its own copy, so tailoring a document never rewrites the source.
- Local-first: documents live in the browser until the user asks for something that needs the server (sync, publishing, AI).
- Open-core: the code and every template are MIT-licensed. The one private part is the AI model and prompt configuration.
- The ATS score comes from an open-source, deterministic engine (`@veriworkly/ats-engine`), not a language model.

## Operating Context

- Surfaces: the marketing site (`apps/site`, veriworkly.com), the Studio editor (app.veriworkly.com), docs, the engineering blog, and portfolios on `*.veriworkly.com` subdomains.
- The free ATS checker runs on the marketing site; its engine is the same one published on npm.
- AI writing uses credits and goes through a model gateway (OpenRouter, named in the privacy policy).
- Release notes are GitHub releases, synced into the changelog.

## Capabilities and Constraints

- Payments are not accepted yet (`PAYMENTS_BLOCKED` on /pricing); all core document building is free.
- There are no free trials. One-time credit packs are valid for 90 days.
- The affiliate and student ambassador programs sit behind feature flags and are off in production.
- Portfolio publishing on a subdomain opens at launch.
- Copy may say a bad parse creates work and risk; it may not say an ATS silently rejects a resume.
- Copy may not claim zero retention or stateless AI processing; neither is enforced in code.
- `apps/site/tests/contracts/claims.contract.test.ts` enforces the claims above.

## Brand Commitments

- The name is `VeriWorkly`: one word, capital V and W.
- Essence line: _One profile. Every document._
- `DESIGN.md` is the visual system; `/style-guide` and `/brand-kit` render it.
- Sample people in marketing content use the founder's name, Gautam Raj. The ATS engine demo is the exception: its strong, weak and keyword-stuffed resumes stay invented, and are pinned by tests.

## Evidence on Hand

- Real template previews (`apps/site/public/templates/`), the product's own interface, the public GitHub repository and its release history, and the engine's published benchmarks and bundle sizes (`apps/site/features/ats-engine/data/`).
- There are no customer testimonials, customer logos, press mentions, or usage numbers. Do not invent any.

## Product Principles

1. Keep users in the editor and close to the content they are changing.
2. Show AI cost and mode before generation, then require an explicit replace action.
3. Preserve local-first ownership and make cloud behavior understandable.
4. Reuse familiar controls and the existing VeriWorkly product language.
5. Make errors actionable without interrupting unrelated editing work.

## Accessibility & Inclusion

Target WCAG 2.2 Level AA. All editor actions require keyboard access, visible focus, readable contrast, non-color status cues, and reduced-motion-compatible feedback.
