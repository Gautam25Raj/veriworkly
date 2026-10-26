export type RoadmapStatus = "todo" | "in-progress" | "done";

interface RoadmapDetailItem {
  name: string;
  description?: string;
  image?: string;
}

interface RoadmapDetails {
  fullDescription?: string;
  whyItMatters?: string;
  timeline?: string;
  problem?: string;
  solution?: string;
  approach?: string;
  keyImprovements?: string[];
  beforeAfter?: Array<{ before: string; after: string }>;
  technicalHighlights?: string[];
  media?: Array<{ type?: string; label?: string; url?: string }>;
  impactMetrics?: string[];
  items?: RoadmapDetailItem[];
}

interface RoadmapInteraction {
  type: string;
  value?: number | null;
  comment?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
  };
}

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  eta?: string | null;
  tags?: string[];
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  completedQuarter?: string | null;
  updatedAt: string;
  fullDescription?: string | null;
  whyItMatters?: string | null;
  timeline?: string | null;
  details?: RoadmapDetails | null;
  interactions?: RoadmapInteraction[];
}
