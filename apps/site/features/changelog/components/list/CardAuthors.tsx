import Image from "next/image";

import { type ChangelogPrRef } from "@/features/changelog/services/changelog-backend";

interface CardAuthorsProps {
  prRefs: ChangelogPrRef[];
}

const MAX_VISIBLE_AUTHORS = 4;

export const CardAuthors = ({ prRefs }: CardAuthorsProps) => {
  if (prRefs.length === 0) return null;

  const authors = prRefs
    .map((pr) => pr.author)
    .filter((author): author is NonNullable<typeof author> => Boolean(author))
    .filter(
      (author, index, all) => all.findIndex((other) => other.login === author.login) === index,
    )
    .slice(0, MAX_VISIBLE_AUTHORS);

  return (
    <div className="text-muted flex items-center gap-2.5 text-base">
      {authors.length > 0 && (
        <div className="flex -space-x-2">
          {authors.map((author) => (
            <Image
              width={24}
              height={24}
              key={author.login}
              alt={author.login}
              title={author.login}
              src={author.avatarUrl}
              className="ring-background rounded-full ring-2"
            />
          ))}
        </div>
      )}

      <span className="tabular-nums">
        {prRefs.length} pull request{prRefs.length === 1 ? "" : "s"}
      </span>
    </div>
  );
};

export default CardAuthors;
