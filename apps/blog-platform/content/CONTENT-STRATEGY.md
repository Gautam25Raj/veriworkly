# Blog Content Strategy

The blog is an acquisition channel, not a changelog. Its job is to be genuinely
useful to people who have never heard of VeriWorkly and may never use it.

## The problem this replaced

The first nine posts were all product-centric. Seven were ~450-word feature notes
("Inside the AI Credit System", "How Affiliate & Ambassador Rewards Actually Work").
The two that targeted real queries pivoted to a product pitch inside two sections —
the ATS guide gave its second H2 to VeriWorkly's `react-pdf` architecture.

Nobody searches for any of that. Product notes are legitimate writing, but they
cannot be the blog's centre of gravity, because they have no audience upstream of
the product.

## Editorial rules

### 1. Write for the query, not the roadmap

Every career post targets a question a person actually types. If you cannot state
that question in the `primaryKeyword` field, the post belongs in the changelog.

### 2. The brand-mention rule

**A product mention has to be the natural next step after a complete answer — never
the answer itself, and never mid-argument.**

Concretely:

- Nothing in the first half of the article.
- Where a tool is genuinely the answer, name competitors alongside ours.
- Say where we are weaker. "Newer, smaller template library, less writing guidance"
  is in the comparison post because it is true.
- If removing the product mention would not damage the article, the article is fine.
  If it would gut it, rewrite the article.

This is not modesty. Content that reads as a pitch does not get linked, quoted, or
cited by AI systems — and citation is the entire mechanism by which this channel works.

### 3. Cite what you assert

Every statistic gets an inline source link. Claims without primary sources get
flagged as such — the ATS pillar exists specifically because the category's most
repeated statistic has no source behind it.

Correcting well-sourced errors is the strongest differentiation available in a
category this saturated with recycled advice.

**Source hierarchy.** Prefer, in order:

1. Peer-reviewed or working-paper research (CESifo, NBER, journal articles)
2. Platform operators publishing their own operational data (Greenhouse on ghost
   jobs, LinkedIn's Recruiter product documentation)
3. Named studies with a published methodology, even vendor-run (ResumeGo's paired
   resume experiment, Clarify Capital's scrape)
4. Vendor aggregation pages — usable only when labelled as such in the text

Never cite a competitor's statistics roundup as a bare authority. If a figure only
exists on pages like that, either label it (`the aggregation above is published by a
resume company, and the underlying methodology is not disclosed`) or leave it out.

**The fabricated-stat beat.** This category now generates plausible-sounding
citations at volume, and several of the most repeated ones do not survive a check.
Each of these is documented in a live post, and finding the next one is a standing
content assignment:

| Claim                                                                            | Status                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| "ATS rejects 75% of resumes"                                                     | Vendor marketing, no primary source                   |
| "_Career Development International_ 2024, two-page resumes get 2.5x callbacks"   | No such paper locatable                               |
| "Complete LinkedIn profiles are 40x more likely to be found"                     | No published LinkedIn source                          |
| "Stack Overflow Developer Survey 2024: 73% of hiring managers prefer portfolios" | Survey samples developers, never asked this           |
| "1 in 3 job listings is fake"                                                    | Misreads an employer survey as a listings measurement |

Checking one before repeating it costs ten minutes and is the only differentiation in
this category that competitors cannot copy by writing faster.

### 4. Depth over frequency

Pillar posts run 1,800–2,800 words and cover a topic completely enough that a reader
does not need a second tab. Four excellent posts outperform twenty thin ones, and
thin content is what the previous approach produced.

### 5. Structure for extraction

AI systems extract passages, not pages:

- Lead each section with a direct answer, then elaborate.
- Bold the one-sentence answer under H1 and major H2s.
- Tables for anything comparative — the most-cited format there is.
- FAQ answers 40–60 words. That is the extraction sweet spot.
- Headings phrased the way people phrase queries.

## Topic clusters

| Cluster                   | Covers                                                      | Status                  |
| ------------------------- | ----------------------------------------------------------- | ----------------------- |
| `ats`                     | Screening software, parsing, formatting, knockout questions | 2 pillars live          |
| `resume-craft`            | Bullets, tailoring, quantifying, length                     | 3 pillars live          |
| `ai-job-search`           | AI on both sides of the table                               | 2 pillars live          |
| `cover-letters`           | Whether, when, structure, AI's effect on them               | 1 pillar live           |
| `job-strategy`            | Volume math, ghost jobs, referrals, follow-up               | 1 pillar live           |
| `career-assets`           | Portfolio, LinkedIn, GitHub as hiring signals               | 2 pillars live          |
| `tools`                   | Comparisons, honest reviews                                 | Pillar live             |
| `product` / `engineering` | Feature and architecture notes                              | Existing, deprioritised |

Clusters matter because Google's AI features fan a single query out into several
related ones. Covering a topic completely beats targeting one keyword per page.

### Named gaps, in priority order

1. **Comparison content.** Comparisons are the single most-cited format in AI
   answers and we have exactly one. Candidates: ATS checkers compared, Teal vs
   Huntr, resume builder alternatives pages.
2. **Original data.** Nothing here is currently sourced from our own systems, and
   it is the one thing competitors cannot copy. We run a parser and a scoring
   engine over real documents — an aggregate analysis of what actually fails
   would be the most citable thing on the blog.
3. **Interview and negotiation.** `job-strategy` covers getting seen, nothing past
   it. Salary negotiation and interview preparation are both high-volume and
   entirely uncovered.
4. **Situational resume guidance.** Career changers, employment gaps, and
   returning to work are high-intent evergreen queries with no coverage.
5. **Named `Person` authors.** Every post is authored by an organisation. Author
   identity and demonstrated expertise are explicit E-E-A-T inputs and a
   documented AI-citation factor, and the frontmatter schema does not yet support
   a person, a bio, or credentials.

## Frontmatter

`source.config.ts` is the authority. Fields beyond the basics feed JSON-LD and
clustering:

- `updated` — real revision date. Drives the sitemap `lastmod` and the visible
  "Updated" stamp. Do not bump it without substantive edits.
- `category` — renders as the post eyebrow. Was hardcoded to "Engineering" on every
  post before this.
- `cluster` — one of the table above.
- `tags` — becomes `keywords` metadata and OG article tags.
- `primaryKeyword` — the question this post answers. If you cannot fill it, reconsider.
- `faq` — rendered as an accordion _and_ emitted as `FAQPage` JSON-LD from one source,
  so the visible and structured answers cannot drift.
- `pillar` — cornerstone posts. Gets higher sitemap priority and a monthly change
  frequency; review these quarterly.

## Refresh cadence

Pillar posts get reviewed quarterly. Statistics age badly, and the freshness signal
is a real ranking and citation input. When refreshing, update `updated` and verify
every cited link still resolves.

## Before publishing

- [ ] `primaryKeyword` is a question a real person types
- [ ] Every statistic has an inline source link
- [ ] Product mention passes the removal test in rule 2
- [ ] Competitors named where genuinely relevant
- [ ] At least one comparison table
- [ ] 3–4 FAQ entries, answers 40–60 words
- [ ] Internal links to 2+ related posts
- [ ] `cluster` and `tags` set
- [ ] Read aloud — no AI verb inflation (`spearheaded`, `leveraged`, `orchestrated`)
