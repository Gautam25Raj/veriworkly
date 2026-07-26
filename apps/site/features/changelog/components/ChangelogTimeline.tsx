import { type ChangelogEntry } from "@/features/changelog/services/changelog-backend";
import ChangelogEntryCard from "./ChangelogEntryCard";

const ChangelogTimeline = ({ entries }: { entries: ChangelogEntry[] }) => {
  if (entries.length === 0) {
    return (
      <div className="border-border/40 bg-card/30 rounded-3xl border border-dashed p-12 text-center">
        <p className="text-foreground font-semibold">No releases match these filters</p>
        <p className="text-muted mt-1.5 text-sm">Try a different search term or release type.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-6">
      {entries.map((entry, index) => (
        <li key={entry.id}>
          <ChangelogEntryCard
            entry={entry}
            isLatest={index === 0}
            previousVersion={entries[index + 1]?.version}
          />
        </li>
      ))}
    </ol>
  );
};

export default ChangelogTimeline;
