export interface SecurityCommitment {
  title: string;
  desc: string;
}

export type DataStop = "browser" | "api" | "database" | "ai" | "web";

export interface EncryptionBoundary {
  id: string;
  action: string;
  title: string;
  description: string;
  specs: string[];
  route: DataStop[];
}

export interface OAuthScopeItem {
  provider: string;
  scope: string;
  accessType: string;
  purpose: string;
  restrictions: string;
}

export interface DataRetentionRow {
  platformArea: string;
  storageLocation: string;
  retentionPeriod: string;
  deletionMethod: string;
  encryption: string;
}

export interface DisclosureStepItem {
  label: string;
  detail: string;
}

export interface ScopeClassification {
  category: string;
  items: string[];
}
