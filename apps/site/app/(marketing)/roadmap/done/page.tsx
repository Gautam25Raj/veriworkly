import { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { jsonLdScriptProps } from "@/utils/json-ld";
import { buildPageMetadata } from "@/utils/metadata";
import {
  type RoadmapSort,
  fetchRoadmapFromBackend,
} from "@/features/roadmap/services/roadmap-backend";

import RoadmapPageShell from "@/features/roadmap/components/RoadmapPageShell";

export const metadata: Metadata = buildPageMetadata({
  path: "/roadmap/done",
  title: `Shipped AI & Platform Features | ${siteConfig.shortName} Roadmap`,
  description:
    "View completed AI features, shipped resume and portfolio updates, and released improvements in the VeriWorkly roadmap.",
  ogTitle: "Everything We've Shipped So Far",
  ogDescription:
    "A running log of completed AI features, ATS improvements, and portfolio updates already live in production.",
  twitterTitle: "Already shipped at VeriWorkly",
  twitterDescription: "See what features have already shipped in VeriWorkly.",
  image: "/og/roadmap/roadmap-done-page-og.png",
  imageAlt: "VeriWorkly Completed Features",
  keywords: ["VeriWorkly changelog", "shipped features", "resume builder release notes"],
});

function parseSort(raw: string | undefined): RoadmapSort | undefined {
  if (raw === "newest" || raw === "oldest" || raw === "recently-completed") {
    return raw;
  }

  return undefined;
}

interface DoneRoadmapPageProps {
  searchParams: Promise<{
    sort?: string;
  }>;
}

const DoneRoadmapPage = async ({ searchParams }: DoneRoadmapPageProps) => {
  const params = await searchParams;

  const data = await fetchRoadmapFromBackend({
    sort: parseSort(params.sort),
    status: "done",
  });

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Roadmap", item: `${siteConfig.url}/roadmap` },
      {
        "@type": "ListItem",
        position: 3,
        name: "Completed",
        item: `${siteConfig.url}/roadmap/done`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
      />

      <RoadmapPageShell
        data={data}
        activeStatus="done"
        basePath="/roadmap/done"
        title="Completed Features"
        description="Explore all features, template improvements, and system updates that have shipped to production."
      />
    </>
  );
};

export default DoneRoadmapPage;
