import Link from "next/link";
import Image from "next/image";
import { GitPullRequest } from "lucide-react";

import { siteConfig } from "@/config/site";

import { TYPE } from "@/components/marketing/PageLayout";

import { type ChangelogPrRef } from "@/features/changelog/services/changelog-backend";

interface ReleasePullRequestsProps {
  prRefs: ChangelogPrRef[];
}

export const ReleasePullRequests = ({ prRefs }: ReleasePullRequestsProps) => {
  if (prRefs.length === 0) return null;

  return (
    <section id="pull-requests" className="scroll-mt-28">
      <h2 className={TYPE.title}>
        Shipped in {prRefs.length} pull request{prRefs.length === 1 ? "" : "s"}
      </h2>

      <ul className="bg-card mt-6 overflow-hidden rounded-3xl">
        {prRefs.map((pr) => (
          <li key={pr.number} className="border-border border-b last:border-b-0">
            <Link
              target="_blank"
              rel="noopener noreferrer"
              href={pr.url ?? `${siteConfig.links.github}/pull/${pr.number}`}
              className="hover:bg-background focus-visible:bg-background flex items-start gap-4 px-5 py-4 text-base transition-colors focus-visible:outline-none sm:px-6"
            >
              {pr.author ? (
                <Image
                  width={28}
                  height={28}
                  alt={pr.author.login}
                  title={pr.author.login}
                  src={pr.author.avatarUrl}
                  className="bg-background mt-0.5 shrink-0 rounded-full"
                />
              ) : (
                <span className="bg-background mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <GitPullRequest className="text-muted size-4" aria-hidden="true" />
                </span>
              )}

              <span className="min-w-0 flex-1 leading-7">{pr.title}</span>
              <span className="text-muted shrink-0 leading-7 tabular-nums">#{pr.number}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ReleasePullRequests;
