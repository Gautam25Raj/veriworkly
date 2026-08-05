import { blog } from "@/lib/source";

export type RelatedPost = {
  url: string;
  title: string;
  description: string;
  category: string;
  sameCluster: boolean;
};

type CurrentPost = {
  url: string;
  cluster?: string;
  tags: string[];
};

/**
 * Surfaces related posts for the in-article footer.
 *
 * `cluster` and `tags` have been in the frontmatter schema since it was written, and
 * `CONTENT-STRATEGY.md` describes `cluster` as driving "related-post surfacing" — but
 * nothing read either field. Topical clusters only build authority if the pages
 * actually link to one another, so this closes the loop.
 *
 * Ranking: same cluster first (an explicit editorial grouping), then shared tag count,
 * with `pillar` breaking ties since those are the pages worth passing link equity to.
 */
export function getRelatedPosts(current: CurrentPost, limit = 3): RelatedPost[] {
  const currentTags = new Set(current.tags);

  const candidates = blog
    .getPages()
    .filter((page) => page.url !== current.url)
    .map((page) => {
      const { title, description, category, cluster, tags, pillar, date, updated } = page.data;
      const sharedTags = tags.filter((tag) => currentTags.has(tag)).length;
      const sameCluster = Boolean(current.cluster) && cluster === current.cluster;

      return {
        url: page.url,
        title,
        description,
        category,
        sameCluster,
        pillar,
        recency: new Date(updated ?? date).getTime(),
        score: (sameCluster ? 100 : 0) + sharedTags * 10,
      };
    });

  const strip = ({ url, title, description, category, sameCluster }: (typeof candidates)[number]) =>
    ({ url, title, description, category, sameCluster }) as RelatedPost;

  const matched = candidates
    .filter((page) => page.score > 0)
    .sort((a, b) => b.score - a.score || b.recency - a.recency)
    .slice(0, limit);

  if (matched.length >= limit) return matched.map(strip);

  // Small clusters would otherwise render one or two cards and leave the row ragged.
  // Backfill with the most recent pillars, which are the pages worth linking to
  // regardless of topical adjacency.
  const chosen = new Set(matched.map((page) => page.url));

  const backfill = candidates
    .filter((page) => !chosen.has(page.url) && page.pillar)
    .sort((a, b) => b.recency - a.recency)
    .slice(0, limit - matched.length);

  return [...matched, ...backfill].map(strip);
}
