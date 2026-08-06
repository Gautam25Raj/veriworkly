import { siteConfig } from "@/config/site";

type FaqItem = { question: string; answer: string };

type PostSchemaInput = {
  title: string;
  description: string;
  author: string;
  date: string | Date;
  updated?: string | Date;
  category?: string;
  tags?: string[];
  faq?: FaqItem[];
  url: string;
  imageUrl: string;
  wordCount?: number;
};

const toISO = (value: string | Date) => new Date(value).toISOString();

const ORG_ID = `${siteConfig.url}/#organization`;
const SITE_ID = `${siteConfig.url}/#website`;

/**
 * The publishing entity. AI systems and search engines resolve authors and publishers
 * as entities, so one canonical node is declared here and referenced by `@id` everywhere
 * else rather than being re-declared inline with slightly different properties.
 */
export const organizationSchema = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: siteConfig.shortName,
  url: siteConfig.links.main,
  logo: {
    "@type": "ImageObject",
    "@id": `${siteConfig.url}/#logo`,
    url: `${siteConfig.url}/veriworkly-logo.png`,
    contentUrl: `${siteConfig.url}/veriworkly-logo.png`,
  },
  sameAs: [siteConfig.links.twitter, siteConfig.links.github, siteConfig.links.linkedin],
};

/**
 * `author` in frontmatter is a byline ("VeriWorkly Team", "VeriWorkly Engineering"),
 * not the name of a legal entity. Emitting it as an `Organization` claimed two
 * organizations exist that do not, and split the publisher entity across three names.
 *
 * Modelled instead as an editorial team that is part of the one real organization,
 * which is both true and resolvable.
 */
function authorNode(author: string) {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.url}/#author-${encodeURIComponent(author.toLowerCase().replace(/\s+/g, "-"))}`,
    name: author,
    url: siteConfig.url,
    parentOrganization: { "@id": ORG_ID },
  };
}

/** Site-level nodes. Emitted once from the root layout, referenced by every page. */
export function buildSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema,
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: "en",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "Blog",
        "@id": `${siteConfig.url}/#blog`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: "en",
        isPartOf: { "@id": SITE_ID },
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/**
 * Builds the JSON-LD graph for a post: BlogPosting, an optional FAQPage, and a
 * breadcrumb trail. Returned as a single `@graph` so one script tag covers all.
 *
 * Note on FAQPage: Google restricted FAQ rich results to authoritative government and
 * health sites in August 2023, so this will not render an accordion in Google SERPs.
 * It is kept because ChatGPT, Perplexity, and Claude do parse it, and because the
 * visible accordion and the markup are generated from one frontmatter source.
 */
export function buildPostSchema({
  title,
  description,
  author,
  date,
  updated,
  category,
  tags = [],
  faq = [],
  url,
  imageUrl,
  wordCount,
}: PostSchemaInput) {
  const graph: Record<string, unknown>[] = [
    organizationSchema,
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: title,
      description,
      image: {
        "@type": "ImageObject",
        url: imageUrl,
        width: 1200,
        height: 630,
      },
      datePublished: toISO(date),
      dateModified: toISO(updated ?? date),
      author: authorNode(author),
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": `${siteConfig.url}/#blog` },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      inLanguage: "en",
      ...(category && { articleSection: category }),
      ...(typeof wordCount === "number" && wordCount > 0 && { wordCount }),
      ...(tags.length > 0 && { keywords: tags.join(", ") }),
      isAccessibleForFree: true,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: siteConfig.url },
        ...(category
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: category,
                item: `${siteConfig.url}/archive`,
              },
            ]
          : []),
        { "@type": "ListItem", position: category ? 3 : 2, name: title, item: url },
      ],
    },
  ];

  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      isPartOf: { "@id": `${url}#article` },
      mainEntity: faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * JSON-LD is injected with `dangerouslySetInnerHTML`, so a literal `</script>` anywhere
 * in a title, description, or FAQ answer would close the tag early. Escaping `<` is the
 * standard mitigation and costs nothing.
 */
export function serializeSchema(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
