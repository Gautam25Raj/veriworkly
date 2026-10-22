import Link from "next/link";
import Image from "next/image";

import { type ChangelogStats } from "@/features/changelog/services/changelog-backend";

const MAX_VISIBLE_AVATARS = 10;

const ChangelogContributors = ({ stats }: { stats: ChangelogStats | null }) => {
  const contributors = stats?.topContributors ?? [];

  if (contributors.length === 0) return null;

  const visible = contributors.slice(0, MAX_VISIBLE_AVATARS);
  const totalCount =
    stats?.contributorCount && stats.contributorCount > 0
      ? stats.contributorCount
      : contributors.length;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ul className="flex -space-x-2">
        {visible.map((author) => (
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

      <p className="text-base">
        Shipped by <span className="font-semibold tabular-nums">{totalCount}</span> open source
        contributor{totalCount === 1 ? "" : "s"}
      </p>
    </div>
  );
};

export default ChangelogContributors;
