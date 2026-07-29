import { cache } from "react";
import { backendApiUrl, firstPartyServerHeaders } from "@/lib/backend";
import { parsePortfolioContent, type PortfolioContent } from "@/lib/portfolio";

export interface PublishedPortfolio {
  subdomain: string;
  snapshot: PortfolioContent;
  templateId: string;
  updatedAt: string;
  isPremium?: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

export const getPublishedPortfolio = cache(
  async (subdomain: string): Promise<PublishedPortfolio | null> => {
    // This serves every public portfolio page — a malformed backend
    // response, a parse failure, a timed-out backend, or any other unexpected
    // throw here must degrade to `null` (→ notFound() upstream) rather than
    // crash the visitor's page with a 500.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(
          backendApiUrl(`/portfolios/public/${encodeURIComponent(subdomain)}`, true),
          {
            headers: firstPartyServerHeaders(),
            next: { revalidate: 3600, tags: [`portfolio-${subdomain}`] },
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) return null;
      const payload = (await response.json()) as { data?: Partial<PublishedPortfolio> };
      if (!payload.data?.snapshot || !payload.data.subdomain) return null;
      return {
        subdomain: payload.data.subdomain,
        snapshot: parsePortfolioContent(payload.data.snapshot),
        templateId: String(payload.data.templateId ?? ""),
        updatedAt: String(payload.data.updatedAt ?? ""),
        isPremium: Boolean(payload.data.isPremium),
      };
    } catch {
      return null;
    }
  },
);
