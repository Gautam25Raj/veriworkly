export interface SecurityCommitment {
  title: string;
  desc: string;
}

/** The places a piece of your text can be, in the order the route diagram draws them. */
export type DataStop = "browser" | "api" | "database" | "ai" | "web";

export interface EncryptionBoundary {
  id: string;
  /** What the visitor does, as the diagram's tab label. */
  action: string;
  title: string;
  description: string;
  specs: string[];
  /** Every stop the text reaches when the visitor takes this action. */
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
