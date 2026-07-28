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

| Cluster | Covers | Status |
| --- | --- | --- |
| `ats` | Screening software, parsing, knockout questions | Pillar live |
| `resume-craft` | Bullets, tailoring, quantifying, formatting, length | 2 pillars live |
| `ai-job-search` | AI on both sides of the table | Pillar live |
| `tools` | Comparisons, honest reviews | Pillar live |
| `job-strategy` | Volume math, referrals, follow-up, negotiation | **Gap** |
| `career-assets` | Portfolio, LinkedIn, GitHub as hiring signals | **Gap** |
| `product` / `engineering` | Feature and architecture notes | Existing, deprioritised |

Clusters matter because Google's AI features fan a single query out into several
related ones. Covering a topic completely beats targeting one keyword per page.

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
- `faq` — rendered as an accordion *and* emitted as `FAQPage` JSON-LD from one source,
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
