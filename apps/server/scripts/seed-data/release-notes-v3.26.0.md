## 🚀 v3.26.0

This release upgrades the ATS engine to 0.5.0, adds a dedicated resume writing category to ATS scoring, and displays spoken languages and certifications as structured rows in the parsed report. It also adds file inspection advice for encrypted PDFs and Word revision marks, links the open-source scoring rubric directly from the checker, sets a Node.js 22.12+ baseline across the repository, cleans up sitemaps and search indexing across all applications, and updates blog guides with verified download and page-count benchmarks.

## ✨ Highlights

### ATS Writing Score & Engine Upgrades
* Upgraded @veriworkly/ats-engine to 0.5.0 across server, site, and Studio (#213, #214, #215).
* Added a dedicated resume writing category (12 points out of 202 total score) to evaluate style, voice, and clarity.
* Rebalanced soft skills weighting in job matching so objective qualifications and writing quality carry appropriate influence.
* Aligned score display thresholds (good from 75, warn from 45) across the gauge, breakdown bars, and Studio.

### Structured Languages & Certifications
* Added dedicated panels for spoken languages and certifications in the parsed view on the site checker tool.
* Studio now sends certifications and spoken languages as structured rows, mapping fluency to standard CEFR levels (such as B1 for limited working proficiency).
* Missing soft skills now appear on their own line in the report view.
* Both the writing category score and structured rows copy over cleanly with the copy-report action.

### File-Level Inspection Advice
* Added a non-scored "Worth knowing" section to the checker report.
* The frontend now sends the file name and size so the backend can detect encrypted PDFs, tracked changes, or comments in Word documents.

### Open-Source Transparency & Search Schema
* Added direct links to the public @veriworkly/ats-engine repository and its scoring rubric in the ATS pipeline section.
* Added JSON-LD WebApplication schema with a stable identifier to the ATS checker marketing page.
* Updated llms.txt with direct references to the published engine package.

### Infrastructure & Runtime
* Raised the minimum Node.js runtime requirement to >=22.12.0 in root package.json.
* Updated Dockerfiles, Docker Compose, and developer setup documentation to Node 22.23.3 (#215).

### Sitemap, Crawler & Search Hygiene
* Dropped invalid cross-domain links from Studio and Site sitemaps.
* Removed dynamic request timestamps from sitemaps so search engines only re-crawl pages when content actually changes.
* Added noindex to `/ats-checker/scan` and removed it from sitemap.ts so search crawlers stay focused on the primary `/ats-checker` landing page.

### Blog & Documentation
* Updated the free resume builders comparison guide with verified October 2026 PDF export limits and pricing.
* Expanded the resume length guide with clear evidence-backed page count guidelines.
* Added the ATS read-back pipeline illustration diagram.

## 🔀 Pull Requests

* **#215** - `chore: Node.js 22.12+ baseline, link ATS engine rubric, JSON-LD schema, engine 0.5.0` by @Gautam25Raj
* **#214** - `feat(ats): move to @veriworkly/ats-engine 0.3.0, add writing category, languages & certs panels` by @Gautam25Raj
* **#213** - `chore(ats): upgrade @veriworkly/ats-engine to 0.2.1` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

* @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.25.1...Release-v3.26.0
