import type { KanbanItem } from "@/components/roadmap/KanbanBoard";

/** Mirrors the server's roadmapService.getRoadmapOrderBy for the oldest and recently-completed sorts. */
export function sortOrders(items: KanbanItem[]) {
  const time = (value?: string) => (value ? Date.parse(value) : NaN);
  const ids = (list: KanbanItem[]) => list.map((item) => item.id);

  return {
    oldest: ids([...items].sort((a, b) => time(a.createdAt) - time(b.createdAt))),
    "recently-completed": ids(
      [...items].sort((a, b) => {
        const ca = time(a.completedAt);
        const cb = time(b.completedAt);
        if (Number.isNaN(ca) !== Number.isNaN(cb)) return Number.isNaN(ca) ? 1 : -1;
        return (cb || 0) - (ca || 0) || time(b.updatedAt) - time(a.updatedAt);
      }),
    ),
  };
}
