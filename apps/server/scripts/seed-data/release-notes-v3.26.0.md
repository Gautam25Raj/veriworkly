This release upgrades the ATS engine to 0.5.0, adds a dedicated resume writing category to ATS scoring, and displays spoken languages and certifications as structured rows in the parsed report. It also adds file advice for encrypted PDFs and Word revision marks, links the public scoring rubric directly from the checker, sets a Node.js 22.12+ baseline across the repository, and adds structured schema markup for search engines.

## ✨ Added

- **Resume writing score category:** Added writing style evaluation (12 points out of 202) to the scoring model. Soft skills now carry slightly less weight in the job match calculation, leaving room for objective writing clarity.
- **Languages and certifications panels:** The parsed resume view on the site now has dedicated panels for spoken languages and certifications. In Studio, certificates and languages are sent as structured rows, with language fluency mapped to standardized CEFR levels (such as B1 for limited working proficiency).
- **Non-scored file advice:** Added a "Worth knowing" section in the checker report. The site passes the file name and size so the server can flag encrypted PDFs and Word documents containing tracked changes or comments.
- **Open-source engine and rubric links:** Added direct links to the public @veriworkly/ats-engine repository and its scoring rubric inside the ATS pipeline section on the landing page.
- **Structured data for ATS checker:** Added JSON-LD WebApplication schema with a stable identifier to the ATS checker marketing page for better search indexing.

## 🔧 Improved

- **Upgraded @veriworkly/ats-engine to 0.5.0:** Updated across the server, site, and Studio. This brings faster parsing, improved PDF reading order detection, Word header extraction, and more accurate matching against job requirements (#213, #214, #215).
- **Display score tone alignment:** The score gauge, breakdown bars, and Studio now use the engine's updated score bands (good from 75, warn from 45).
- **Checker copy and reports:** Missing soft skills now appear on their own line in the report. Both the writing score and new categories copy over cleanly when using the copy-report button. The parser normalizer also tolerates older backend responses without failing.
- **Landing page copy:** Clarified in the landing page grid that resume scans run securely on the server rather than third-party browser proxies.
- **AI documentation:** Updated llms.txt to reference the open-source engine package and rubric.

## ⚙️ Dependencies & runtime

- **Node.js 22.12+ requirement:** Raised the minimum required Node.js version in package.json from 20 to `>=22.12.0`. Updated the production Dockerfile, Docker Compose files, local setup guide, and documentation to use Node 22.23.3 (#215).

## 🐛 Fixed

- **Template read-back on multi-page resumes:** Fixed an issue where the centered SKILLS heading on the final page of the executive-clarity template was read after its child lines, causing skills to be missed.
- **Sitemap and crawler hygiene:** Dropped invalid cross-domain links from Studio and Site sitemaps, removed dynamic request timestamps so search engines only re-crawl updated content, added noindex to `/ats-checker/scan`, and removed it from `sitemap.ts`.

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.25.1...Release-v3.26.0
