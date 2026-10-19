import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import Image from "next/image";
import { BookOpen, Gauge, Terminal } from "lucide-react";

import { siteConfig } from "@/config/site";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex items-center gap-2">
        <Image
          width={24}
          height={24}
          alt="VeriWorkly Logo"
          className="rounded-md"
          src="/veriworkly-logo.png"
        />

        <span className="font-semibold">{siteConfig.name}</span>
      </div>
    ),
    url: "/",
  },

  links: [
    {
      text: "Docs",
      url: "/docs",
    },
    {
      text: "ATS Engine",
      url: "/ats-engine",
    },
    {
      text: "API Reference",
      url: "/api-reference",
    },
    {
      text: "Blog",
      url: siteConfig.links.blog,
    },
  ],

  githubUrl: siteConfig.links.github,
};

/** The three docs trees, shared by each tree's layout so the switcher is the same everywhere. */
export const docsTabs = [
  {
    title: "VeriWorkly Docs",
    url: "/docs",
    icon: <BookOpen className="size-4" />,
    description: "General documentation",
  },
  {
    title: "ATS Engine",
    url: "/ats-engine",
    icon: <Gauge className="size-4" />,
    description: "Open-source resume parser and scorer",
  },
  {
    title: "API Reference",
    url: "/api-reference",
    icon: <Terminal className="size-4" />,
    description: "OpenAPI specifications",
  },
];
