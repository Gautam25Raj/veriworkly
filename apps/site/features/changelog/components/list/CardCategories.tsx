import { categoryCountsFor } from "@/features/changelog/utils/changelog-utils";
import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";

interface CardCategoriesProps {
  entry: ChangelogEntry;
}

export const CardCategories = ({ entry }: CardCategoriesProps) => {
  const counts = categoryCountsFor(entry);

  if (counts.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
      {counts.map(({ category, count, label, dot }) => (
        <li key={category} className="flex items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="text-muted">{label.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
};

export default CardCategories;
