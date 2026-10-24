"use client";

import Link from "next/link";

import { Button } from "../../ui/Button";

import { ThemeToggle } from "../theme/ThemeToggle";
import { GithubIcon } from "../social/SocialIcons";

interface MarketingNavActionsProps {
  githubHref: string;
  appHref: string;
  ctaLabel?: string;
}

export const MarketingNavActions = ({
  githubHref,
  appHref,
  ctaLabel = "Start Building",
}: MarketingNavActionsProps) => {
  return (
    <div className="hidden items-center gap-4 lg:flex">
      <Link
        target="_blank"
        href={githubHref}
        rel="noopener noreferrer"
        aria-label="VeriWorkly on GitHub (opens in a new tab)"
        className="text-muted hover:text-foreground hover:bg-accent/5 focus-visible:ring-accent flex size-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <GithubIcon className="size-5" />
      </Link>

      <ThemeToggle />

      <Button
        asChild
        variant="primary"
        className="shadow-accent/10 hover:shadow-accent/20 px-6 font-semibold shadow-lg"
      >
        <Link href={appHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
};
