## 🚀 v3.28.0

This release moves the server, site and Studio to @veriworkly/ats-engine 0.14.0 and fixes the ATS checker's server side. "Analyze from a job URL" works again, one slow upload no longer fails the uploads behind it, and a Redis outage no longer hangs every request. The checker now reads hidden text in a PDF or Word file more precisely: white keywords no longer count, and visible skills are no longer dropped because a hidden line repeats them.

## ✨ Highlights

### ATS Engine 0.14.0

- Upgraded @veriworkly/ats-engine from 0.11.0 to 0.14.0 in the server, site and Studio.
- Hidden text is set aside only where the extracted text actually holds it, and white text after visible text on one line is cut from that line. On 6,000 generated resumes, hidden-only skills counted fell from 902 to 14, and visible skills lost to hidden text fell from 1,267 to 43.
- Job postings saved as UTF-16 (Notepad's "Unicode") or Windows-1252 are read correctly instead of matching nothing.
- The docs and the /ats-engine page read bundle sizes from the installed engine, so they always match the version the site runs.

### Job URLs & Uploads

- "Analyze from a job URL" failed for every address on Node 20 and later. It works again, with a 15-second limit on the whole fetch.
- One slow or crashing upload no longer fails every upload queued behind it, and an upload the server refuses for its own reasons no longer uses up a scan.
- A file over 5 MB now says it is too large, instead of "Internal server error".
- A long PDF no longer fails the scan because a layout count ran past its limit.

### Reliability

- During a Redis outage, requests fall back at once instead of waiting for a reconnect that may never come.
- The docs' preview images answer "not found" for a missing page instead of an error, and all preview-image routes run on Node, which removes the Edge runtime build warnings.

### Security

- The job-URL fetcher refuses IPv6 addresses that carry an internal IPv4 address (mapped, compatible and NAT64 forms).
- The anonymous scan quota and rate limits count an IPv6 /64 as one client, so one connection can no longer rotate addresses to get more scans.
- The upload route accepts no extra form fields.

### Docs

- Documented engine 0.12 to 0.14: hidden text in the job match, posting decoding, empty postings, the MCP server's child process, the GitHub Action's report path and the AI answer limit.
- Removed reading files in the browser from the engine roadmap.

## 🔀 Pull Requests

- **#219** - `[Fix] [Server/Site/Studio/Docs]: move to engine 0.14.0, harden ats uploads and redis, release 3.28.0` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.27.0...Release-v3.28.0
