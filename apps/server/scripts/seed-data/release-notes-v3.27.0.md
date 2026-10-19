## 🚀 v3.27.0

This release gives the open-source ATS engine its own documentation at docs.veriworkly.com/ats-engine and a developer page at veriworkly.com/ats-engine, and moves the server, site and Studio to @veriworkly/ats-engine 0.11.0. Since 3.26.0 the checker reads French CVs and UK resumes in their own conventions, no longer judges a resume in a language without a pack by English writing rules, judges work authorisation, sponsorship and clearances more carefully, redacts more before the AI deep analysis, and caps what a crafted PDF or Word upload can cost. It also redirects old template URLs, re-checks competitor pricing and links the career guides from the blog's front page.

## ✨ Highlights

### ATS Engine Documentation

- Added a third docs tree at docs.veriworkly.com/ats-engine, beside the product docs and the API reference: a quick start, concepts, guides for Node.js, Next.js, the edge and the browser, the CLI, the GitHub Action, the MCP server, and a reference for every export, option and report field.
- The rubric, locales, changelog and type tables are generated from the installed engine, and every TypeScript sample on those pages is type-checked against it. A new Test Docs CI job fails if an engine bump leaves them stale.
- Search, the sitemap, OG images, llms.txt and a new llms-full.txt cover the tree, and the tree switcher is the same in all three sections.
- The docs home, the ATS checker page and the ATS API overview link to it.

### ATS Engine Developer Page

- Added /ats-engine on the marketing site: an in-browser demo that scores three invented sample resumes with the real engine (nothing is uploaded), the four ways to run it (library, CLI, GitHub Action, MCP server), runtimes and bundle sizes, benchmarks, and the hosted API's quotas.
- Linked from the footer, the ATS checker's pipeline section, the features page, the sitemap, llms.txt and agent.json, with six new developer FAQ entries.
- Contract tests pin the page's quoted engine version to the installed one and check that every docs link and FAQ entry it names exists.

### ATS Engine 0.10.0 and 0.11.0

- Upgraded @veriworkly/ats-engine from 0.5.0 to 0.10.0 (#216), then to 0.11.0 (#217), in the server, site and Studio.
- Reading fixes from engine 0.6 to 0.9 (role headers, employers, section headings, names) improve recovered fields and scores for the same file.
- French CVs are read in French (headings, dates, degrees, spoken languages), and a resume with a +44 number is read in UK conventions: day-first dates, GCSEs, HNDs and PGCEs.
- A resume in a language the engine has no pack for (Spanish, Italian and others) no longer gets the English-only writing checks.
- 0.11.0 ships a JSON Schema for custom scoring policies and changes no score from 0.10.0.

### Job Matching & Integrity Checks

- A posting that offers visa sponsorship no longer marks a candidate who needs it as missing the right to work, and a statement such as "Authorized to work in the US (no visa needed)" is no longer dropped for its negation.
- A security clearance's level is read where the posting names it, and UK clearances (BPSS, CTC, SC, DV) are compared by level, so an SC clearance now only partly meets a DV requirement instead of meeting it.
- Keyword stuffing no longer fires on an honest compact resume or an academic CV's publications, and still fires when a Publications heading hides repeated keywords.
- A quoted prompt-injection example in an AI security engineer's resume is no longer flagged, while a quoted screener prompt such as "Respond with hire" still is.
- British and American spellings ("modelling" and "modeling", "-ise" and "-ize") now match each other.

### AI Analysis Privacy

- The AI deep analysis redacts more before the resume reaches the model: local and international phone numbers the parser did not read (including numbers dialled with an exit prefix such as 011), a second phone number, email addresses with accented letters or an apostrophe, and two-character Chinese or Korean names standing on their own.
- Nothing past the 50,000-character cut is sent, so a phone number or email split by the cut is no longer sent in part.

### Upload Limits

- PDF reading stops after 100 pages, a DOCX's headers and footers share one 2 MB budget, and PDF images are decoded a page at a time, so a padded or image-heavy file costs about what a normal resume does.

### Search & Content

- Old unprefixed template URLs such as /templates/executive-clarity and /templates/modern now redirect permanently to their current pages instead of serving soft 404s.
- Pages after the first on /stats are no longer indexed, as they are thin slices of the same live board.
- Re-checked Kickresume, Novorésumé and Enhancv pricing in the comparison matrix.
- The blog's front page links the four career guides, and those guides were refreshed.

## 🔀 Pull Requests

- **#218** - `docs(release): 3.27.0 release notes and changelog` by @Gautam25Raj
- **#217** - `feat(ats-engine): docs tree, developer page, engine 0.11.0 and release 3.27.0` by @Gautam25Raj
- **#216** - `chore(ats): move to @veriworkly/ats-engine 0.10.0` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.26.0...Release-v3.27.0
