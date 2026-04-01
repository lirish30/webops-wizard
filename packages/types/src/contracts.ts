export interface IntegrationStatus {
  id: string;
  provider: "ga4" | "gsc" | "sitemap" | "crawler";
  status: "connected" | "warning" | "error" | "syncing";
  lastSuccessAt: string | null;
}

export interface RecommendationCard {
  id: string;
  propertyId: string;
  title: string;
  domain:
    | "seo"
    | "cro"
    | "content"
    | "technical"
    | "analytics-governance";
  severity: "low" | "medium" | "high" | "critical";
  confidenceScore: number;
  actionabilityScore: number;
}

export interface QueueContract<TPayload> {
  name: string;
  version: number;
  payload: TPayload;
}

export const workflowQueueNames = [
  "connector-sync",
  "crawl-ingestion",
  "page-identity-resolution",
  "metric-aggregation",
  "trust-scoring",
  "recommendation-generation",
  "report-generation",
  "alert-evaluation",
  "cache-refresh"
] as const;

export type WorkflowQueueName = (typeof workflowQueueNames)[number];

export interface BaseWorkflowPayload {
  workspaceId: string;
  propertyId?: string | null | undefined;
  integrationConnectionId?: string | undefined;
  trigger?: "manual" | "schedule" | "retry" | "webhook" | undefined;
  requestedByUserId?: string | undefined;
  idempotencyKey: string;
  requestedAt: string;
}

export type ConnectorSyncPayload = BaseWorkflowPayload & {
  integrationConnectionId: string;
  trigger: "manual" | "schedule" | "retry";
};

export type CrawlIngestionPayload = BaseWorkflowPayload;
export type PageIdentityResolutionPayload = BaseWorkflowPayload;
export type MetricAggregationPayload = BaseWorkflowPayload;
export type TrustScoringPayload = BaseWorkflowPayload;
export type RecommendationGenerationPayload = BaseWorkflowPayload;
export type ReportGenerationPayload = BaseWorkflowPayload;
export type AlertEvaluationPayload = BaseWorkflowPayload;
export type CacheRefreshPayload = BaseWorkflowPayload;

export interface WorkflowPayloadByQueue {
  "connector-sync": ConnectorSyncPayload;
  "crawl-ingestion": CrawlIngestionPayload;
  "page-identity-resolution": PageIdentityResolutionPayload;
  "metric-aggregation": MetricAggregationPayload;
  "trust-scoring": TrustScoringPayload;
  "recommendation-generation": RecommendationGenerationPayload;
  "report-generation": ReportGenerationPayload;
  "alert-evaluation": AlertEvaluationPayload;
  "cache-refresh": CacheRefreshPayload;
}
