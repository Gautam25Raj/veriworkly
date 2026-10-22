import { GithubIcon } from "@veriworkly/ui";

import { siteConfig } from "@/config/site";

import { PageSection, TYPE } from "@/components/marketing/PageLayout";
import { LandingButton } from "@/components/marketing/LandingButton";

const STACK = [
  ["License", "MIT, open core"],
  ["Storage", "Your browser's local storage"],
  ["Rendering", "In-browser vector compiler"],
  ["Sign-in", "Better Auth, passwordless one-time codes"],
  ["Exports", "PDF, DOCX, Markdown, HTML, text, JSON"],
  ["Portfolios", "Edge TLS per subdomain, no cookies"],
];

const CHECKS = [
  ["Audit it", "Read how storage, sign-in and exports work before you trust them."],
  ["Run it", "Clone the repository and run the whole platform on your machine."],
  ["Own it", "MIT-licensed: self-host the studio, fork it, or contribute back."],
];

export const ArchitectureAndDocsSection = () => (
  <PageSection
    id="architecture"
    title="Don't trust us. Read the code."
    lede="The core is open source, so nothing on this page has to be taken on trust."
  >
    <div className="grid gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
      <div
        data-ui
        className="reveal bg-foreground text-background min-w-0 overflow-hidden rounded-3xl"
      >
        <p className="px-6 pt-5 text-sm font-semibold opacity-70 sm:px-8">How it is built</p>
        <dl className="px-6 pt-3 pb-7 sm:px-8">
          {STACK.map(([term, value]) => (
            <div
              key={term}
              className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-current/15 py-3.5 first:border-t-0 sm:grid-cols-[8rem_1fr]"
            >
              <dt className="text-base opacity-70">{term}</dt>
              <dd className="text-base font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="reveal">
        <dl className="space-y-6">
          {CHECKS.map(([term, detail]) => (
            <div key={term}>
              <dt className={TYPE.title}>{term}</dt>
              <dd className="text-muted mt-1.5 text-base leading-7 text-pretty">{detail}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <LandingButton size="lg" variant="solid" href={siteConfig.links.github} target="_blank">
            <span className="inline-flex items-center gap-2">
              <GithubIcon className="size-4" />
              View on GitHub
            </span>
          </LandingButton>
          <LandingButton size="lg" variant="outline" href={siteConfig.links.docs} target="_blank">
            Documentation
          </LandingButton>
        </div>
      </div>
    </div>
  </PageSection>
);

export default ArchitectureAndDocsSection;
