import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { siteConfig } from "@/config/site";

import { type ChangelogStats } from "@/features/changelog/services/changelog-backend";

/**
 * Everyone who has shipped a release, all of them, each a link to their GitHub profile. The
 * server already caps the list at a size a row of faces can hold.
 */
const ChangelogContributors = ({ stats }: { stats: ChangelogStats | null }) => {
  const contributors = stats?.topContributors ?? [];

  if (contributors.length === 0) return null;

  const totalCount = Math.max(stats?.contributorCount ?? 0, contributors.length);

  return (
    <div>
      <p className="text-base">
        Shipped by <span className="font-semibold tabular-nums">{totalCount}</span> open source
        contributor{totalCount === 1 ? "" : "s"}
      </p>

      <ul className="mt-4 flex flex-wrap -space-x-2" aria-label="Contributors">
        {contributors.map((author) => (
          <li key={author.login}>
            <Link
              target="_blank"
              href={author.htmlUrl}
              rel="noopener noreferrer"
              title={`@${author.login} on GitHub`}
              className="ring-background focus-visible:ring-accent relative block rounded-full ring-2 transition-transform duration-200 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-none"
            >
              <Image
                width={36}
                height={36}
                alt={`@${author.login}`}
                src={author.avatarUrl}
                className="bg-card rounded-full"
              />
            </Link>
          </li>
        ))}
      </ul>

      <a
        target="_blank"
        rel="noopener noreferrer"
        href={`${siteConfig.links.github}/graphs/contributors`}
        className="text-accent group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
      >
        See every contribution on GitHub
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </a>
    </div>
  );
};

export default ChangelogContributors;
