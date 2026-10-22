export interface WorkflowStepItem {
  /** Anchor id on /how-it-works. */
  id: string;
  /** Short label for the route under the headline. */
  label: string;
  title: string;
  subtitle: string;
  description: string;
  points: { term: string; detail: string }[];
}
