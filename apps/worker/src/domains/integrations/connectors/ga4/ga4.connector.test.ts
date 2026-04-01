import { describe, expect, it } from "vitest";

import type {
  Ga4DailyPageMetric,
  Ga4FetchDailyPageMetricsResult,
  Ga4PropertySummary,
  Ga4Provider
} from "../../../../../../../packages/integrations/src/index";

import { InMemoryCredentialStore } from "../../credentials/in-memory-credential-store";
import { InMemorySyncPersistence, runConnectorSync } from "../../sync/sync-runner";
import { createRetryPolicy } from "../../sync/retry";
import { createGa4Connector, type PageMetricsStore } from "./ga4.connector";

class FakeGa4Provider implements Ga4Provider {
  constructor(
    private readonly response: {
      metrics?: Ga4DailyPageMetric[];
      latestDataDate?: string | null;
      failures?: Ga4FetchDailyPageMetricsResult["failures"];
      properties?: Ga4PropertySummary[];
    } = {}
  ) {}

  async startOAuth() {
    return {
      authorizationUrl: "https://example.test/oauth",
      state: "ga4-state"
    };
  }

  async completeOAuth() {
    return {
      credentialPayload: {
        refreshToken: "refresh-token",
        accessToken: "access-token",
        expiresAt: "2026-04-02T00:00:00.000Z"
      },
      account: {
        id: "acct_1",
        displayName: "Example account"
      }
    };
  }

  async listProperties() {
    return (
      this.response.properties ?? [
        {
          propertyId: "properties/1001",
          displayName: "Primary property"
        }
      ]
    );
  }

  async fetchDailyPageMetrics() {
    return {
      rows:
        this.response.metrics ??
        [
          {
            date: "2026-03-31",
            pagePath: "https://example.com/pricing",
            sessions: 42,
            users: 30,
            entrances: 20,
            engagementRate: 0.51,
            avgEngagementSeconds: 88,
            conversionCount: 4,
            conversionRate: 0.095238
          }
        ],
      latestDataDate: this.response.latestDataDate ?? "2026-03-31",
      failures: this.response.failures ?? []
    };
  }
}

class InMemoryPageMetricsStore implements PageMetricsStore {
  readonly rows: Ga4DailyPageMetric[] = [];

  constructor(private readonly unresolvedPagePaths: string[] = []) {}

  async ingest() {
    return {
      recordsSynced: 1,
      unresolvedPagePaths: this.unresolvedPagePaths
    };
  }
}

describe("ga4 connector", () => {
  it("syncs normalized daily page metrics and records unresolved pages as partial failure", async () => {
    const connector = createGa4Connector({
      provider: new FakeGa4Provider(),
      pageMetricsStore: new InMemoryPageMetricsStore([
        "https://example.com/unmapped"
      ])
    });
    const persistence = new InMemorySyncPersistence();
    const credentialStore = new InMemoryCredentialStore();

    await credentialStore.put({
      reference: "cred-ga4-1",
      workspaceId: "ws_1",
      provider: "ga4",
      payload: {
        refreshToken: "refresh-token",
        accessToken: "expired-token",
        expiresAt: "2026-04-01T00:00:00.000Z"
      }
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_1",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "ga4",
        credentialRef: "cred-ga4-1",
        freshnessSlaMinutes: 1440,
        configJson: {
          selectedProperty: {
            propertyId: "properties/1001",
            displayName: "Primary property"
          }
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T04:00:00.000Z"),
      connector,
      credentialStore,
      persistence,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.coverage.succeededSegments).toBe(1);
    expect(result.coverage.expectedSegments).toBe(2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        segment: "page-resolution",
        retryable: false
      })
    );
    expect(result.freshness.latestDataAt).toBe("2026-03-31T00:00:00.000Z");
  });

  it("surfaces provider-declared partial failures without dropping successful rows", async () => {
    const connector = createGa4Connector({
      provider: new FakeGa4Provider({
        failures: [
          {
            segment: "backfill:2026-03-20:2026-03-22",
            code: "GA4_TIMEOUT",
            message: "Timed out fetching archived rows",
            retryable: true
          }
        ]
      }),
      pageMetricsStore: new InMemoryPageMetricsStore()
    });
    const persistence = new InMemorySyncPersistence();
    const credentialStore = new InMemoryCredentialStore();

    await credentialStore.put({
      reference: "cred-ga4-2",
      workspaceId: "ws_1",
      provider: "ga4",
      payload: {
        refreshToken: "refresh-token",
        accessToken: "token",
        expiresAt: "2026-04-02T00:00:00.000Z"
      }
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_2",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "ga4",
        credentialRef: "cred-ga4-2",
        freshnessSlaMinutes: 1440,
        configJson: {
          selectedProperty: {
            propertyId: "properties/1001",
            displayName: "Primary property"
          },
          pendingBackfill: {
            startDate: "2026-03-20",
            endDate: "2026-03-22"
          }
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T04:00:00.000Z"),
      connector,
      credentialStore,
      persistence,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        segment: "backfill:2026-03-20:2026-03-22",
        retryable: true
      })
    );
  });
});
