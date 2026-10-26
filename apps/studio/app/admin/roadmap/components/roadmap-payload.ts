import type { AdminRoadmapPayload } from "@/features/roadmap/services/admin-roadmap";
import type { RoadmapStatus } from "@/features/roadmap/services/roadmap-backend";

export interface RoadmapFormValues {
  title: string;
  description: string;
  status: RoadmapStatus;
  eta: string;
  completedQuarter: string;
  tags: string;
  fullDescription: string;
  whyItMatters: string;
  timeline: string;
  startedAt: string;
  completedAt: string;
  detailsJson: string;
}

/**
 * The request body for the roadmap form. An empty optional field is left out of a create (the
 * server has nothing to clear) and sent as `null` on an edit, which is how an operator clears it.
 */
export function buildRoadmapPayload(
  values: RoadmapFormValues,
  mode: "create" | "edit",
): AdminRoadmapPayload {
  const empty = mode === "create" ? undefined : null;
  const text = (value: string) => value.trim() || empty;
  const date = (value: string) => (value ? new Date(value).toISOString() : empty);

  let details: Record<string, unknown> | null | undefined = empty;

  if (values.detailsJson.trim()) {
    try {
      details = JSON.parse(values.detailsJson) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid Details JSON format");
    }
  }

  const payload: AdminRoadmapPayload = {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    eta: text(values.eta),
    tags: values.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    fullDescription: text(values.fullDescription),
    whyItMatters: text(values.whyItMatters),
    timeline: text(values.timeline),
    startedAt: date(values.startedAt),
    completedAt: date(values.completedAt),
    completedQuarter: text(values.completedQuarter),
    details,
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as AdminRoadmapPayload;
}
