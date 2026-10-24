export interface WorkflowStepItem {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  points: { term: string; detail: string }[];
}
