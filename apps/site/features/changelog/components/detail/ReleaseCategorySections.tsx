import { cn } from "@veriworkly/ui";

import ChangelogRichText from "./ChangelogRichText";

import { TYPE } from "@/components/marketing/PageLayout";
import { categoriesFor } from "@/features/changelog/utils/changelog-utils";
import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";

/** Release notes write detailed items as "**Heading**: what changed". */
const TITLED_ITEM = /^\*\*(.+?)\*\*:?\s+([\s\S]+)$/;

interface ReleaseCategorySectionsProps {
  entry: ChangelogEntry;
}

export const ReleaseCategorySections = ({ entry }: ReleaseCategorySectionsProps) => {
  const categories = categoriesFor(entry);

  if (categories.length === 0)
    return (
      <p className="text-muted text-base leading-7 text-pretty">
        No itemised changes were recorded for this release. The GitHub release and its pull requests
        carry the full detail.
      </p>
    );

  return (
    <div className="space-y-16">
      {categories.map(({ category, items, label, dot }) => {
        // Short bullets first, then the detailed items: the order release notes use.
        const bullets = items.filter((item) => !TITLED_ITEM.test(item));
        const detailed = items.flatMap((item) => {
          const match = TITLED_ITEM.exec(item);
          return match ? [{ item, heading: match[1]!, body: match[2]! }] : [];
        });

        return (
          <section key={category} id={category} className="scroll-mt-28">
            <h2 className={cn("flex items-center gap-3", TYPE.title)}>
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${dot}`} />
              {label}
              <span className="text-muted text-base font-medium tabular-nums">{items.length}</span>
            </h2>

            {bullets.length > 0 && (
              <ul className="mt-6 space-y-3">
                {bullets.map((item) => (
                  <li key={item} className="flex gap-3.5 text-base leading-7">
                    <span
                      aria-hidden="true"
                      className={`mt-[0.7rem] size-1.5 shrink-0 rounded-full ${dot}`}
                    />
                    <span className="min-w-0 text-pretty">
                      <ChangelogRichText content={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {detailed.length > 0 && (
              <ul className="bg-card mt-8 overflow-hidden rounded-3xl">
                {detailed.map(({ item, heading, body }) => (
                  <li
                    key={item}
                    className="border-border border-b px-6 py-5 last:border-b-0 sm:px-7"
                  >
                    <p className="text-base leading-7 font-semibold text-balance">
                      <ChangelogRichText content={heading} />
                    </p>
                    <p className="text-muted mt-1 text-base leading-7 text-pretty">
                      <ChangelogRichText content={body} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ReleaseCategorySections;
