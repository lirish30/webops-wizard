import type { CredentialStore } from "../credentials/credential-store";

export type SyncTrigger = "schedule" | "manual" | "retry";
export type ConnectorProvider =
  | "ga4"
  | "gsc"
  | "sitemap"
  | "crawler"
  | "wordpress"
  | "hubspot"
  | "other";

export interface ConnectorConnectionContext {
  id: string;
  workspaceId: string;
  propertyId: string | null;
  provider: ConnectorProvider;
  credentialRef: string | null;
  freshnessSlaMinutes: number | null;
  configJson: Record<string, unknown> | null;
}

export interface ConnectorSyncSegmentResult {
  segment: string;
  status: "success" | "failed";
  recordsSynced?: number;
  retryable?: boolean;
  code?: string;
  message?: string;
}

export interface ConnectorSyncResult {
  fetchedAt: Date;
  latestDataAt: Date | null;
  segments: ConnectorSyncSegmentResult[];
}

export interface OAuthRefreshInput {
  credentialReference: string;
  credentialStore: CredentialStore;
  now: Date;
}

export interface OAuthRefreshResult {
  accessToken: string;
  expiresAt: string;
}

export interface ConnectorOAuthHooks {
  refreshAccessToken(input: OAuthRefreshInput): Promise<OAuthRefreshResult>;
}

export interface ConnectorModule {
  provider: ConnectorProvider;
  oauth: ConnectorOAuthHooks;
  sync(input: {
    connection: ConnectorConnectionContext;
    now: Date;
    credentialStore: CredentialStore;
  }): Promise<ConnectorSyncResult>;
}

export interface FreshnessMetadata {
  latestDataAt: string | null;
  checkedAt: string;
  lagMinutes: number | null;
  withinSla: boolean;
}

export interface CoverageMetadata {
  expectedSegments: number;
  succeededSegments: number;
  ratio: number;
  missingSegments: string[];
}
