import Image from "next/image";

import { cn } from "@veriworkly/ui";

import {
  type ChangelogPrRef,
  type ChangelogPrAuthor,
} from "@/features/changelog/services/changelog-backend";

export function prAuthors(prRefs: ChangelogPrRef[]): ChangelogPrAuthor[] {
  const seen = new Map<string, ChangelogPrAuthor>();

  for (const pr of prRefs) {
    if (pr.author && !seen.has(pr.author.login.toLowerCase()))
      seen.set(pr.author.login.toLowerCase(), pr.author);
  }

  return [...seen.values()];
}

export const AvatarStack = ({
  people,
  max = 5,
  size = 28,
}: {
  people: ChangelogPrAuthor[];
  max?: number;
  size?: number;
}) => {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="flex items-center -space-x-2">
      {shown.map((person) => (
        <Image
          key={person.login}
          width={size}
          height={size}
          alt={`@${person.login}`}
          title={`@${person.login}`}
          src={person.avatarUrl}
          className="bg-card ring-background rounded-full ring-2"
        />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size }}
          className="bg-card ring-background text-muted relative flex items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-2"
        >
          +{rest}
        </span>
      )}
    </span>
  );
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A release with no linked pull request says so, so the column never disappears. */
export const CardAuthors = ({
  prRefs,
  className,
}: {
  prRefs: ChangelogPrRef[];
  className?: string;
}) => {
  const authors = prAuthors(prRefs);

  if (prRefs.length === 0)
    return <p className={cn("text-muted text-sm", className)}>No linked pull requests</p>;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {authors.length > 0 && <AvatarStack people={authors} />}
      <p className="text-muted text-sm tabular-nums">
        <span className="block">{plural(prRefs.length, "pull request")}</span>
        {authors.length > 0 && (
          <span className="block">{plural(authors.length, "contributor")}</span>
        )}
      </p>
    </div>
  );
};

export default CardAuthors;
