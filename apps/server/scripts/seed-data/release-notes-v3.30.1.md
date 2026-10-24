## 🚀 v3.30.1

This patch updates Next.js to clear two critical security advisories, fixes a crash that older Safari and Firefox versions hit on pages with tooltips, and corrects the public API reference. It also fixes account deletion leaving the session cookie in the browser.

## ✨ Highlights

### Security

- Updated Next.js from 16.3.8 to 16.4.3 in the site, Studio, portfolio, blog and docs. This fixes two critical remote code execution advisories (one in `use cache`, one in the image optimizer with SVG files) and a denial of service in Server Actions. We don't use `use cache`, but the site does use the image optimizer and a Server Action, so the update matters there.
- Updated `proxy-addr`, which the server uses to read the visitor's IP for rate limits, to close an IP spoofing advisory. Also updated `nodemailer` (the server sends mail to addresses users type in), `multer`, `sharp`, `vite` and `vitest`.
- Removed the version pins we kept in the root `package.json`. They were only there to force patched versions, and the same versions are now set in the normal dependency ranges.
- One alert stays open: `zod` 3 in the server, Studio and the shared profile package. The flagged code only exists in zod 4, and nothing here uses it.

### Fixes

- Pages with a tooltip crashed in older browsers (Safari 16 and Firefox ESR 115). The collapsed portfolio sidebar was one of them. They now load, and the tooltip works there.
- The keyboard focus ring on the checkboxes in the API key form was cut off. It shows again.
- In browsers without `hidden="until-found"` (Safari and older Firefox), a closed FAQ answer could still be read by screen readers and reached with Tab. Closed answers are now hidden from both.
- A dialog that was already open when the page loaded, such as the share password screen, opened twice and replayed its animation. It now opens once.
- Tab in a dropdown menu moves on to the next control after the button. Opening a dialog on desktop no longer shifts the navbar by the scrollbar width. A button made with `asChild` keeps its own disabled state and tab order. The on and off states of a switch can be told apart in Windows high-contrast mode.
- Deleting your account now clears the session cookie properly when the sign-in cookie is shared across subdomains. Before, the browser kept the old cookie.
- The 3.30.0 changelog entry had no publish date, which stopped the changelog from being saved. It has a date now, and its notes are corrected: a degree requirement that says "or related field" no longer accepts years of work instead of the degree, and an old scoring policy still starts the server but lacks the new country, clearance and date handling.

### API Reference

- The API reference had several errors, found by checking every operation against the server code. The sign-in limit is 3 per minute, not 20. Too many wrong codes returns `403`, not `400`. Sign-out and the session endpoint work without a cookie. The roadmap, changelog and GitHub reads need an API key with the right scope. `PUT /profiles/master` only requires `templateId`, `basics`, `links`, `summary` and `customization`.
- Added the error responses the server returns but the reference left out (`401`, `402`, `409`, `413`, `429`, `503`), the missing request fields, and `DELETE /users/me`.
- There is now one public copy of `openapi.json`, at `docs.veriworkly.com/openapi.json`. The site, Studio, portfolio and blog redirect `/openapi.json` there instead of each serving their own.
- A typo in the spec used to remove an endpoint and its page without failing the build. Now it stops with a clear message, and CI fails when the generated API pages are out of date.

### Updates

- Docs and blog: fumadocs 16.17.8, fumadocs-mdx 15.4.10. All apps: lucide-react 1.61, React 19.3.1, and the latest ESLint config for Next.js.
- Server: Prisma 7.10.1, Better Auth 1.6.33.
- A new test checks that every changelog entry has a real date, a unique version and the fields the seed script reads.

## 🔀 Pull Requests

- **#231** - `[Fix] [Server]: clear session cookies with the cookie domain on account deletion` by @Gautam25Raj
- **#230** - `[Chore] [Site/Studio/Portfolio/Blog/Docs/Server/UI]: drop the npm overrides and refresh dependencies` by @Gautam25Raj
- **#229** - `[Fix] [UI/Studio]: fix the tooltip crash in older browsers and the other review findings` by @Gautam25Raj
- **#228** - `[Fix] [Server/Docs]: give the 3.30.0 changelog entry a date and correct its release notes` by @Gautam25Raj
- **#227** - `[Fix] [Docs/Site/Studio/Portfolio/Blog]: correct the API spec, harden its generator and check it in CI` by @Gautam25Raj
- **#226** - `[Fix] [Site/Studio/Portfolio/Blog/Docs/Server]: patch Next.js 16.4.3 and clear the open security advisories` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.30.0...Release-v3.30.1
