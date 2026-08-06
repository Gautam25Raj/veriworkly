import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Plus } from "lucide-react";

import { Badge, Button } from "@veriworkly/ui";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { ChartSeries } from "@/components/admin/charts/ChartDefs";
import { chartColor } from "@/components/admin/charts/ChartDefs";

import type { RoadmapStatus } from "@/features/roadmap/services/roadmap-backend";
import { fetchAdminRoadmapServer } from "@/features/admin/services/admin-server";

import DeleteRoadmapButton from "@/app/admin/roadmap/components/DeleteRoadmapButton";

/**
 * Column accents come from the chart ramp rather than raw Tailwind steps. The previous version
 * used `bg-slate-50/50`, `bg-blue-50/50` and `border-slate-50`, all of which are light-mode-only
 * values — on the dark theme they rendered as near-white slabs against a #0d1117 background.
 */
const statusConfig: Record<RoadmapStatus, { label: string; series: ChartSeries }> = {
  todo: { label: "To do", series: 2 },
  "in-progress": { label: "In progress", series: 1 },
  done: { label: "Done", series: 3 },
};

export const metadata: Metadata = {
  title: "Admin · Roadmap",
  description: "Create, update, and organize public roadmap items from admin panel.",
  robots: { index: false, follow: false },
};

const AdminRoadmapPage = async () => {
  const items = (await fetchAdminRoadmapServer()) ?? [];

  const grouped: Record<RoadmapStatus, typeof items> = {
    todo: [],
    "in-progress": [],
    done: [],
  };

  items.forEach((item) => {
    if (grouped[item.status]) grouped[item.status].push(item);
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Platform"
        title="Roadmap"
        description="Feature requests and development progress. Every item here is visible on the public roadmap page."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/roadmap/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              New feature
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(grouped) as RoadmapStatus[]).map((status) => {
          const column = statusConfig[status];

          return (
            <div key={status} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: chartColor(column.series) }}
                    aria-hidden="true"
                  />

                  <h2 className="admin-label text-foreground">{column.label}</h2>
                </div>

                <span className="text-muted admin-numeric text-xs">{grouped[status].length}</span>
              </div>

              <div className="border-border bg-admin-inset min-h-96 flex-1 rounded-xl border border-dashed p-2">
                {grouped[status].length === 0 ? (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-muted text-xs">Nothing in this column.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {grouped[status].map((item) => (
                      <li
                        key={item.id}
                        className="group border-border bg-card rounded-lg border p-3 transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      >
                        <h3 className="text-foreground group-hover:text-accent text-sm font-semibold transition-colors">
                          {item.title}
                        </h3>

                        <p className="text-muted mt-1 line-clamp-2 text-xs leading-relaxed">
                          {item.description}
                        </p>

                        {item.timeline ? (
                          <p className="text-muted mt-2 flex items-center gap-1.5 text-xs">
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {item.timeline}
                          </p>
                        ) : null}

                        {item.tags && item.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <Badge
                                key={`${item.id}-${tag}`}
                                className="rounded-md px-1.5 py-0 text-[11px] capitalize"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="border-border mt-2.5 flex items-center justify-end gap-1 border-t pt-2">
                          <Button size="sm" asChild variant="ghost" className="h-7 text-xs">
                            <Link href={`/admin/roadmap/${item.id}/edit`}>Edit</Link>
                          </Button>

                          <DeleteRoadmapButton id={item.id} title={item.title} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default AdminRoadmapPage;
