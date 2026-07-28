import { siteConfig } from "@/config/site";

type FaqItem = { question: string; answer: string };

type PostSchemaInput = {
  title: string;
  description: string;
  author: string;
  date: string | Date;
  updated?: string | Date;
  tags?: string[];
  faq?: FaqItem[];
  url: string;
  imageUrl: string;
};

const toISO = (value: string | Date) => new Date(value).toISOString();

/**
 * The publishing entity. AI systems resolve authors and publishers as entities,
 * so the same `@id` is reused everywhere rather than re-declared inline.
 */
const organization = {
  "@type": "Organization",
  "@id": `${siteConfig.url}/#organization`,
  name: siteConfig.shortName,
  url: siteConfig.links.main,
  logo: {
    "@type": "ImageObject",
    url: `${siteConfig.url}/veriworkly-logo.png`,
  },
  sameAs: [siteConfig.links.twitter, siteConfig.links.github, siteConfig.links.linkedin],
};

/**
 * Builds the JSON-LD graph for a post: BlogPosting, an optional FAQPage, and a
 * breadcrumb trail. Returned as a single `@graph` so one script tag covers all.
 */
export function buildPostSchema({
  title,
  description,
  author,
  date,
  updated,
  tags = [],
  faq = [],
  url,
  imageUrl,
}: PostSchemaInput) {
  const graph: Record<string, unknown>[] = [
    organization,
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: title,
      description,
      image: imageUrl,
      datePublished: toISO(date),
      dateModified: toISO(updated ?? date),
      author: {
        "@type": "Organization",
        name: author,
        url: siteConfig.links.main,
      },
      publisher: { "@id": `${siteConfig.url}/#organization` },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      ...(tags.length > 0 && { keywords: tags.join(", ") }),
      isAccessibleForFree: true,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: title, item: url },
      ],
    },
  ];

  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
