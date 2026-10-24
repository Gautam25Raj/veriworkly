## 🚀 v3.31.0

This release makes the marketing site safe to deploy when the backend is down, brings every price and limit on it in line with the product, and makes it lighter to load. It also adds files that help search engines and AI assistants describe VeriWorkly correctly.

## ✨ Highlights

### Reliability

- A deploy while the API was unreachable used to turn every release page into "Release Not Found" for a week, and cut the sitemap down to one changelog link. Those pages now load from the API on demand, and the sitemap keeps its last good copy.
- The roadmap shows which columns failed to load instead of an empty board, and each column's Refresh button reloads it.
- Server errors on the site can be sent to an error endpoint (`ERROR_REPORT_URL`). Without it, they are written as one structured log line.

### Accurate pages

- Prices, scan and import limits, credit packs and the "payments are closed" notice now match what the product does. Tests compare the site's copy with the server's numbers and fail when they drift.
- `pricing.md` and `llms.txt` say plainly that paid plans can't be bought yet.

### Search

- Page titles and descriptions fit in search results, and release pages get short, readable titles.
- One consistent set of structured data for the organisation, website and product.
- Dead links such as `/support` and `/careers` redirect to the right pages, and the sitemap dates the legal pages.

### Faster pages

- The navigation bar and mobile menu are plain CSS. The animation library now loads only on the 7 pages that use it.
- Most pages load about 45 KB less JavaScript (gzipped). The home page skips work on sections you haven't scrolled to yet.
- Template preview images are smaller, with no visible change.

### AI assistants

- New `/llms-full.txt`: the overview, FAQ, templates, comparisons and pricing in one file.
- The about, features, how-it-works and security pages open with a short, direct answer.

### Forms

- The contact form shows an error next to each field. The ATS checker explains when an upload is too large or the rate limit is reached. An ambassador application started before signing in is submitted once you are back.

### Studio

- A few style class names were swapped for their standard names. Nothing looks different.

## 🔀 Pull Requests

- **#233** - `[Feature] [Site/Studio]: make the site production ready and release 3.31.0` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.30.1...Release-v3.31.0
