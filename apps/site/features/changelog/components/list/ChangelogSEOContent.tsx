import Link from "next/link";

import { siteConfig } from "@/config/site";

import { PageSection } from "@/components/marketing/PageLayout";

const ChangelogSEOContent = () => (
  <PageSection
    tone="card"
    className="border-t"
    title="Where these notes come from."
    lede={
      <>
        Every entry is generated from the release history of our public{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={siteConfig.links.github}
          className="text-accent underline underline-offset-4"
        >
          GitHub repository
        </a>
        . Changes are grouped into added, improved, fixed, security and breaking, and each links
        back to the pull requests that shipped it, so you can read the code behind every line. For
        what is planned rather than shipped, see the{" "}
        <Link href="/roadmap" className="text-accent underline underline-offset-4">
          public roadmap
        </Link>
        .
      </>
    }
  />
);

export default ChangelogSEOContent;
