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
  path: "/roadmap/todo",
  title: `Planned AI Features & Updates | ${siteConfig.shortName} Roadmap`,
  description:
    "Discover planned AI features, upcoming resume and portfolio templates, and future platform updates in the VeriWorkly roadmap.",
  ogTitle: "What We're Building Next",
  ogDescription:
    "Queued feature requests and planned AI capabilities, straight from the VeriWorkly public backlog.",
  twitterTitle: "Up next on the VeriWorkly roadmap",
  twitterDescription: "See what features are planned next in the VeriWorkly workspace roadmap.",
  image: "/og/roadmap/roadmap-todo-page-og.png",
  imageAlt: "VeriWorkly Planned Features Roadmap",
  keywords: ["VeriWorkly planned features", "resume builder roadmap", "upcoming AI features"],
});

function parseSort(raw: string | undefined): RoadmapSort | undefined {
  if (raw === "newest" || raw === "oldest" || raw === "recently-completed") {
    return raw;
  }

  return undefined;
}

interface TodoRoadmapPageProps {
  searchParams: Promise<{
    sort?: string;
  }>;
}

const TodoRoadmapPage = async ({ searchParams }: TodoRoadmapPageProps) => {
  const params = await searchParams;

  const data = await fetchRoadmapFromBackend({
    sort: parseSort(params.sort),
    status: "todo",
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
        name: "Planned",
        item: `${siteConfig.url}/roadmap/todo`,
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
        activeStatus="todo"
        basePath="/roadmap/todo"
        title="Planned Features"
        description="Explore concepts and feature requests currently queued for upcoming development cycles."
      />
    </>
  );
};

export default TodoRoadmapPage;
