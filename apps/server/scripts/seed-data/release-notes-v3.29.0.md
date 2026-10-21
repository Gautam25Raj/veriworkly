## 🚀 v3.29.0

This release moves the server, site and Studio to @veriworkly/ats-engine 0.16.0 (from 0.14.0). The ATS checker now catches keyword stuffing that names a few skills again and again on one line. A job posting titled with a level, such as "Senior Backend Engineer", gets a seniority row in the requirements table. A resume that copies one bullet into three or four roles is no longer marked as keyword stuffing, so some resumes gain 10 points.

## ✨ Highlights

### ATS Engine 0.15.0

- Upgraded @veriworkly/ats-engine from 0.14.0 to 0.15.0 in the server, site, Studio and docs.
- A line like "Keywords: Python Kubernetes AWS Docker Go Kafka", written four times on one line, used to pass the keyword-stuffing check, because each term made up only 16% of the line. The check now also counts a line's terms together: terms named three times or more each, totalling 10 words or more and half the line, are stuffing.
- With the default policy, an invented sales manager's resume with that line added falls from 92 to 82. Naming the same skills once, or in a comma, pipe or semicolon list, is judged as before.
- The job match is unchanged. The terms are on the page, and naming them once gives the same match.

### ATS Engine 0.16.0

- Upgraded @veriworkly/ats-engine from 0.15.0 to 0.16.0 in the server, site, Studio and docs.
- A job posting whose first line is a title naming a level ("Senior Backend Engineer", "Staff Software Engineer", "Junior Developer") now gets a first row in the requirements table, `kind: "seniority"`. The resume's latest title and years judge it: met, partial or missing. The score does not change.
- A sentence bullet copied word for word once into each of three or four roles is no longer keyword stuffing. Of 3,000 generated resumes, 46 gain 10 points. Five or more roles still count as stuffing.
- The policy gains `keywordMatch.requirements.seniorityLevels`, so the default policy's fingerprint changes. A private policy built for 0.15.0 must be rebuilt before the server deploys.
- The policy's JSON Schema is strict, so an editor flags a misspelt key. A job posting saved as `.xhtml` is read as a web page. The MCP server (0.10.0) takes a `region` for `explain_rule`.
- The rule count (35) and the report's other fields are unchanged.

### Docs

- Regenerated the engine reference pages and the changelog for 0.16.0, and moved the hand-written version strings (the sample report and its policy fingerprint, the policy `$schema` URL, the GitHub Action default, the MCP server line, the benchmarks heading).
- The integrity page says a line that names a few skills again and again counts as keyword stuffing, and that a bullet copied into three or four roles does not.
- The job matching page describes the seniority row, and the MCP page shows `region` on `explain_rule`.

## 🔀 Pull Requests

- **#221** - `[Chore] [Server/Site/Studio/Docs]: move to @veriworkly/ats-engine 0.16.0` by @Gautam25Raj
- **#220** - `[Chore] [Server/Site/Studio/Docs]: move to @veriworkly/ats-engine 0.15.0` by @Gautam25Raj

## ❤️ Contributors

Thank you to everyone who contributed code, reviews, and documentation to this release:

- @Gautam25Raj

## 📦 Full Changelog

**Full Changelog**: https://github.com/VeriWorkly/veriworkly/compare/Release-v3.28.0...Release-v3.29.0
