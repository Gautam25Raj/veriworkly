## 🚀 v3.29.0

This release moves the server, site and Studio to @veriworkly/ats-engine 0.15.0. The ATS checker now catches keyword stuffing that names a few skills again and again on one line, each under five times. Such a resume gets a keyword-stuffing deduction in the hosted checker, where it used to pass.

## ✨ Highlights

### ATS Engine 0.15.0

- Upgraded @veriworkly/ats-engine from 0.14.0 to 0.15.0 in the server, site, Studio and docs.
- A line like "Keywords: Python Kubernetes AWS Docker Go Kafka", written four times on one line, used to pass the keyword-stuffing check, because each term made up only 16% of the line. The check now also counts a line's terms together: terms named three times or more each, totalling 10 words or more and half the line, are stuffing.
- With the default policy, an invented sales manager's resume with that line added falls from 92 to 82. Naming the same skills once, or in a comma, pipe or semicolon list, is judged as before.
- The job match is unchanged. The terms are on the page, and naming them once gives the same match.
- The report's shape, the policy schema, the limits and the rule count (35) are unchanged. Bundle sizes moved by noise only.

### Docs

- Regenerated the engine reference pages and the changelog for 0.15.0, and moved the hand-written version strings (the sample report, the policy `$schema` URL, the GitHub Action default, the MCP server line, the benchmarks heading).
- The integrity page now says a line that names a few skills again and again counts as keyword stuffing.

## 🔀 Pull Requests

- **#220** - `[Chore] [Server/Site/Studio/Docs]: move to @veriworkly/ats-engine 0.15.0` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.28.0...Release-v3.29.0
