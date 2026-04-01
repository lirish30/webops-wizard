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
