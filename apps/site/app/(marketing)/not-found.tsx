import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/utils/metadata";

import { NotFoundPage } from "@/components/marketing/StatusPage";

export const metadata: Metadata = buildPageMetadata({
  path: "/404",

  title: `Page Not Found | ${siteConfig.shortName}`,

  description: "This page moved or never existed. Head back home or browse the template directory.",

  ogTitle: "This Page Isn't Here",
  ogDescription:
    "It may have moved or never existed. Head back home, or browse the templates instead.",

  twitterTitle: "404 - Page Not Found",

  twitterDescription: "This page moved or never existed. Head back to VeriWorkly.",

  image: "/og/landing-page-og.png",

  noIndex: true,
});

const MarketingNotFound = () => <NotFoundPage />;

export default MarketingNotFound;
