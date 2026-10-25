import { config } from "#config";

import { logger } from "#lib/logger";
import { cacheDel } from "#lib/redis";
import { bumpGeneration, resolveGenerationalKey } from "#lib/cacheGeneration";

/**
 * The two public caches live in separate namespaces under `portfolio:public:` (the prefix the
 * admin cache flush knows). Sites are keyed `...:site:<subdomain>` and the list
 * `...:list:g<generation>[:l:o]`, so no subdomain (not even `list`, which is also reserved) can
 * read or poison the other. The list is a generation namespace: one INCR drops every page.
 */
export const PUBLIC_LIST_CACHE_NAMESPACE = "portfolio:public:list";

export function publicPortfolioCacheKey(subdomain: string) {
  return `portfolio:public:site:${subdomain}`;
}

/** Reads the list generation; call before the DB query. `null` means skip the cache. */
export function publicPortfolioListCacheKey(limit?: number, offset?: number) {
  return limit !== undefined || offset !== undefined
    ? resolveGenerationalKey(PUBLIC_LIST_CACHE_NAMESPACE, String(limit || 0), String(offset || 0))
    : resolveGenerationalKey(PUBLIC_LIST_CACHE_NAMESPACE);
}

function uniqueSubdomains(subdomains: string[]) {
  return [...new Set(subdomains.filter(Boolean))];
}

export async function invalidatePublicPortfolioCaches(subdomains: string[]) {
  const unique = uniqueSubdomains(subdomains);

  await Promise.all([
    bumpGeneration(PUBLIC_LIST_CACHE_NAMESPACE),
    ...unique.map((subdomain) => cacheDel(publicPortfolioCacheKey(subdomain))),
  ]);
}

export async function revalidatePublicPortfolios(subdomains: string[]) {
  const unique = uniqueSubdomains(subdomains);

  if (unique.length === 0) return;

  const CHUNK_SIZE = 50;
  const chunks: string[][] = [];

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map(async (chunk, index) => {
      try {
        const paths =
          index === 0
            ? ["/sitemap.xml", ...chunk.map((subdomain) => `/portfolios/${subdomain}`)]
            : chunk.map((subdomain) => `/portfolios/${subdomain}`);

        const tags =
          index === 0
            ? ["portfolios-list", ...chunk.map((subdomain) => `portfolio-${subdomain}`)]
            : chunk.map((subdomain) => `portfolio-${subdomain}`);

        const response = await fetch(`${config.portfolio.url}/api/revalidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paths,
            tags,
            secret: config.portfolio.revalidateSecret,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          logger.warn(`Failed to revalidate public portfolio paths for chunk ${index + 1}`, {
            status: response.status,
            body: await response.text(),
          });
        }
      } catch (error) {
        logger.warn(
          `Failed to trigger public portfolio revalidation for chunk ${index + 1}`,
          error,
        );
      }
    }),
  );
}
