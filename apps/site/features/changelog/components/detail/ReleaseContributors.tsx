import Link from "next/link";
import Image from "next/image";

import { type ChangelogPrAuthor } from "@/features/changelog/services/changelog-backend";

interface ReleaseContributorsProps {
  contributors: ChangelogPrAuthor[];
  headingClassName?: string;
}

export const ReleaseContributors = ({
  contributors,
  headingClassName,
}: ReleaseContributorsProps) => {
  if (contributors.length === 0) return null;

  return (
    <section>
      <h2 className={headingClassName}>
        {contributors.length === 1 ? "Contributor" : `${contributors.length} contributors`}
      </h2>

      <ul className="mt-4 space-y-1">
        {contributors.map((c) => (
          <li key={c.login}>
            <Link
              target="_blank"
              href={c.htmlUrl}
              rel="noopener noreferrer"
              className="hover:bg-card focus-visible:ring-accent/40 -mx-3 flex items-center gap-3 rounded-xl px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Image
                width={28}
                height={28}
                alt=""
                src={c.avatarUrl}
                className="bg-card rounded-full"
              />
              @{c.login}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ReleaseContributors;
