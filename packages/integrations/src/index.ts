export interface Ga4OAuthStartInput {
  workspaceId: string;
  integrationConnectionId: string;
  redirectUri: string;
}

export interface Ga4OAuthStartResult {
  authorizationUrl: string;
  state: string;
}

export interface Ga4OAuthCompleteInput {
  workspaceId: string;
  integrationConnectionId: string;
  code: string;
  state: string;
  redirectUri: string;
}

export interface Ga4OAuthCompleteResult {
  credentialPayload: {
    refreshToken: string;
    accessToken: string;
    expiresAt: string;
  };
  account: {
    id: string;
    displayName: string;
  };
}

export interface Ga4PropertySummary {
  propertyId: string;
  displayName: string;
}

export interface Ga4DailyPageMetric {
  date: string;
  pagePath: string;
  sessions?: number;
  users?: number;
  entrances?: number;
  engagementRate?: number;
  avgEngagementSeconds?: number;
  conversionCount?: number;
  conversionRate?: number;
}

export interface Ga4FetchDailyPageMetricsFailure {
  segment: string;
  code: string;
  message: string;
  retryable: boolean;
}

export interface Ga4FetchDailyPageMetricsInput {
  propertyId: string;
  startDate: string;
  endDate: string;
  accessToken: string;
}

export interface Ga4FetchDailyPageMetricsResult {
  rows: Ga4DailyPageMetric[];
  latestDataDate: string | null;
  failures: Ga4FetchDailyPageMetricsFailure[];
}

export interface Ga4Provider {
  startOAuth(input: Ga4OAuthStartInput): Promise<Ga4OAuthStartResult>;
  completeOAuth(input: Ga4OAuthCompleteInput): Promise<Ga4OAuthCompleteResult>;
  listProperties(input: {
    workspaceId: string;
    integrationConnectionId: string;
    accessToken: string;
  }): Promise<Ga4PropertySummary[]>;
  fetchDailyPageMetrics(
    input: Ga4FetchDailyPageMetricsInput
  ): Promise<Ga4FetchDailyPageMetricsResult>;
}

export interface GscOAuthStartInput {
  workspaceId: string;
  integrationConnectionId: string;
  redirectUri: string;
}

export interface GscOAuthStartResult {
  authorizationUrl: string;
  state: string;
}

export interface GscOAuthCompleteInput {
  workspaceId: string;
  integrationConnectionId: string;
  code: string;
  state: string;
  redirectUri: string;
}

export interface GscOAuthCompleteResult {
  credentialPayload: {
    refreshToken: string;
    accessToken: string;
    expiresAt: string;
  };
  account: {
    id: string;
    displayName: string;
  };
}

export interface GscSiteSummary {
  siteUrl: string;
  displayName: string;
}

export interface GscDailyQueryMetric {
  date: string;
  pageUrl: string;
  query: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  avgPosition?: number;
}

export interface GscFetchDailyQueryMetricsFailure {
  segment: string;
  code: string;
  message: string;
  retryable: boolean;
}

export interface GscFetchDailyQueryMetricsInput {
  siteUrl: string;
  startDate: string;
  endDate: string;
  accessToken: string;
}

export interface GscFetchDailyQueryMetricsResult {
  rows: GscDailyQueryMetric[];
  latestDataDate: string | null;
  failures: GscFetchDailyQueryMetricsFailure[];
}

export interface GscProvider {
  startOAuth(input: GscOAuthStartInput): Promise<GscOAuthStartResult>;
  completeOAuth(input: GscOAuthCompleteInput): Promise<GscOAuthCompleteResult>;
  listSites(input: {
    workspaceId: string;
    integrationConnectionId: string;
    accessToken: string;
  }): Promise<GscSiteSummary[]>;
  fetchDailyQueryMetrics(
    input: GscFetchDailyQueryMetricsInput
  ): Promise<GscFetchDailyQueryMetricsResult>;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days: string[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }

  return days;
}

export function createPlaceholderGa4Provider(): Ga4Provider {
  return {
    async startOAuth(input) {
      const state = `ga4-${input.integrationConnectionId}`;
      return {
        authorizationUrl: `${input.redirectUri}?provider=ga4&state=${state}`,
        state
      };
    },

    async completeOAuth(input) {
      return {
        credentialPayload: {
          refreshToken: `refresh-${input.integrationConnectionId}`,
          accessToken: `access-${input.code}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        },
        account: {
          id: `acct-${input.integrationConnectionId.slice(0, 8)}`,
          displayName: "Placeholder GA4 account"
        }
      };
    },

    async listProperties(input) {
      return [
        {
          propertyId: "properties/1001",
          displayName: "Primary Web Property"
        },
        {
          propertyId: "properties/1002",
          displayName: `Sandbox ${input.integrationConnectionId.slice(0, 4)}`
        }
      ];
    },

    async fetchDailyPageMetrics(input) {
      const days = buildDateRange(input.startDate, input.endDate);

      return {
        rows: days.flatMap((date, index) => [
          {
            date,
            pagePath: "https://example.com/",
            sessions: 120 + index,
            users: 90 + index,
            entrances: 70 + index,
            engagementRate: 0.58,
            avgEngagementSeconds: 82,
            conversionCount: 6,
            conversionRate: 0.05
          },
          {
            date,
            pagePath: "https://example.com/pricing",
            sessions: 48 + index,
            users: 38 + index,
            entrances: 31 + index,
            engagementRate: 0.62,
            avgEngagementSeconds: 96,
            conversionCount: 4,
            conversionRate: 0.083333
          }
        ]),
        latestDataDate: days.at(-1) ?? null,
        failures: []
      };
    }
  };
}

export function createPlaceholderGscProvider(): GscProvider {
  return {
    async startOAuth(input) {
      const state = `gsc-${input.integrationConnectionId}`;
      return {
        authorizationUrl: `${input.redirectUri}?provider=gsc&state=${state}`,
        state
      };
    },

    async completeOAuth(input) {
      return {
        credentialPayload: {
          refreshToken: `refresh-${input.integrationConnectionId}`,
          accessToken: `access-${input.code}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        },
        account: {
          id: `acct-${input.integrationConnectionId.slice(0, 8)}`,
          displayName: "Placeholder GSC account"
        }
      };
    },

    async listSites(input) {
      return [
        {
          siteUrl: "sc-domain:example.com",
          displayName: "Example Domain"
        },
        {
          siteUrl: `https://${input.integrationConnectionId.slice(0, 4)}.example.com/`,
          displayName: "Example URL-prefix Site"
        }
      ];
    },

    async fetchDailyQueryMetrics(input) {
      const days = buildDateRange(input.startDate, input.endDate);

      return {
        rows: days.flatMap((date, index) => [
          {
            date,
            pageUrl: "https://example.com/",
            query: "webops wizard",
            clicks: 20 + index,
            impressions: 200 + index,
            ctr: 0.1,
            avgPosition: 4.2
          },
          {
            date,
            pageUrl: "https://example.com/pricing",
            query: "webops wizard pricing",
            clicks: 8 + index,
            impressions: 80 + index,
            ctr: 0.1,
            avgPosition: 3.1
          }
        ]),
        latestDataDate: days.at(-1) ?? null,
        failures: []
      };
    }
  };
}
