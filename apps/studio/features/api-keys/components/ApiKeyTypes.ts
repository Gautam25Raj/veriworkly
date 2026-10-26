export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsed: string | null;
  /** Optional until `GET /api-keys` selects them; without them the list can only tell active from not. */
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface ApiKeyDetailRecord {
  id: string;
  keyPrefix: string;
  keySuffix: string;
  name: string;
  isActive: boolean;
  rateLimit: number;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  lastUsed: string | null;
}

export interface GeneratedApiKeyRecord extends ApiKeyDetailRecord {
  key: string;
}
