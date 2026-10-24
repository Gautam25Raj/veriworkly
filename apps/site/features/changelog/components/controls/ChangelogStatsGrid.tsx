import { TYPE } from "@/components/marketing/PageLayout";
import { type ChangelogStats } from "@/features/changelog/services/changelog-backend";

const ChangelogStatsGrid = ({ stats }: { stats: ChangelogStats | null }) => {
  if (!stats) return null;

  const figures = [
    { label: "Latest version", value: stats.latest ? `v${stats.latest.version}` : null },
    { label: "Releases shipped", value: stats.totalEntries },
    { label: "Minor and major", value: stats.minor + stats.major },
    { label: "Patch releases", value: stats.patch },
  ].filter((figure) => figure.value !== null);

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.label} className="border-border flex flex-col-reverse border-t pt-5">
          <dt className="text-muted mt-3 text-base">{figure.label}</dt>
          <dd className={TYPE.figure}>{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
};

export default ChangelogStatsGrid;
