import { describe, expect, it } from "vitest";

import type {
  GscDailyQueryMetric,
  GscFetchDailyQueryMetricsResult,
  GscProvider,
  GscSiteSummary
} from "../../../../../../../packages/integrations/src/index";

import { InMemoryCredentialStore } from "../../credentials/in-memory-credential-store";
import { createRetryPolicy } from "../../sync/retry";
import { InMemorySyncPersistence, runConnectorSync } from "../../sync/sync-runner";
import { createGscConnector, type SearchConsoleMetricsStore } from "./gsc.connector";

class FakeGscProvider implements GscProvider {
  constructor(
    private readonly response: {
      metrics?: GscDailyQueryMetric[];
      latestDataDate?: string | null;
      failures?: GscFetchDailyQueryMetricsResult["failures"];
      sites?: GscSiteSummary[];
    } = {}
  ) {}

  async startOAuth() {
    return {
      authorizationUrl: "https://example.test/oauth",
      state: "gsc-state"
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

  async listSites() {
    return (
      this.response.sites ?? [
        {
          siteUrl: "sc-domain:example.com",
          displayName: "Example Domain"
        }
      ]
    );
  }

  async fetchDailyQueryMetrics() {
    return {
      rows:
        this.response.metrics ??
        [
          {
            date: "2026-03-31",
            pageUrl: "https://example.com/pricing",
            query: "pricing software",
            clicks: 10,
            impressions: 100,
            ctr: 0.1,
            avgPosition: 3.2
          }
        ],
      latestDataDate: this.response.latestDataDate ?? "2026-03-31",
      failures: this.response.failures ?? []
    };
  }
}

class InMemorySearchConsoleMetricsStore implements SearchConsoleMetricsStore {
  readonly rows: GscDailyQueryMetric[] = [];

  constructor(private readonly unresolvedPageUrls: string[] = []) {}

  async ingest(input: { rows: GscDailyQueryMetric[] }) {
    this.rows.push(...input.rows);

    return {
      pageRecordsSynced: input.rows.length,
      queryRecordsSynced: input.rows.length,
      unresolvedPageUrls: this.unresolvedPageUrls
    };
  }
}

describe("gsc connector", () => {
  it("syncs page-query metrics and records unresolved pages as partial failure", async () => {
    const connector = createGscConnector({
      provider: new FakeGscProvider(),
      metricsStore: new InMemorySearchConsoleMetricsStore(["https://example.com/unmapped"])
    });
    const persistence = new InMemorySyncPersistence();
    const credentialStore = new InMemoryCredentialStore();

    await credentialStore.put({
      reference: "cred-gsc-1",
      workspaceId: "ws_1",
      provider: "gsc",
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
        provider: "gsc",
        credentialRef: "cred-gsc-1",
        freshnessSlaMinutes: 2880,
        configJson: {
          selectedSite: {
            siteUrl: "sc-domain:example.com",
            displayName: "Example Domain"
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
    expect(result.coverage.succeededSegments).toBe(2);
    expect(result.coverage.expectedSegments).toBe(3);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        segment: "page-resolution",
        retryable: false
      })
    );
    expect(result.freshness.latestDataAt).toBe("2026-03-31T00:00:00.000Z");
  });

  it("surfaces provider-declared daily failures without dropping successful rows", async () => {
    const connector = createGscConnector({
      provider: new FakeGscProvider({
        failures: [
          {
            segment: "day:2026-03-20",
            code: "GSC_TIMEOUT",
            message: "Timed out fetching archived rows",
            retryable: true
          }
        ]
      }),
      metricsStore: new InMemorySearchConsoleMetricsStore()
    });
    const persistence = new InMemorySyncPersistence();
    const credentialStore = new InMemoryCredentialStore();

    await credentialStore.put({
      reference: "cred-gsc-2",
      workspaceId: "ws_1",
      provider: "gsc",
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
        provider: "gsc",
        credentialRef: "cred-gsc-2",
        freshnessSlaMinutes: 2880,
        configJson: {
          selectedSite: {
            siteUrl: "sc-domain:example.com",
            displayName: "Example Domain"
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
        segment: "day:2026-03-20",
        retryable: true
      })
    );
  });
});
