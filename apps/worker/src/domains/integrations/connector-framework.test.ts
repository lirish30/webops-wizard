import { beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryCredentialStore } from "./credentials/in-memory-credential-store";
import type {
  ConnectorModule,
  ConnectorSyncResult
} from "./connectors/connector.types";
import {
  ConnectorExecutionError,
  createRetryPolicy,
  runWithRetry
} from "./sync/retry";
import { createConnectorRegistry } from "./connectors/connector.registry";
import { createGa4Connector } from "./connectors/ga4/ga4.connector";
import {
  InMemorySyncPersistence,
  runConnectorSync
} from "./sync/sync-runner";
import { PrismaSyncPersistence } from "./sync/prisma-sync-persistence";
import { buildDueSyncJobs } from "./sync/scheduler";

const prismaMockFns = vi.hoisted(() => ({
  connectorSyncRunCreate: vi.fn(),
  integrationConnectionUpdate: vi.fn(),
  dataSourceHealthCreate: vi.fn()
}));

vi.mock("@webops-wizard/db", () => ({
  prisma: {
    connectorSyncRun: {
      create: prismaMockFns.connectorSyncRunCreate
    },
    integrationConnection: {
      update: prismaMockFns.integrationConnectionUpdate
    },
    dataSourceHealth: {
      create: prismaMockFns.dataSourceHealthCreate
    }
  }
}));

function createTestConnector(
  sync: ConnectorModule["sync"]
): ConnectorModule {
  return {
    provider: "ga4",
    oauth: {
      async refreshAccessToken() {
        return {
          accessToken: "token",
          expiresAt: new Date("2026-04-01T00:00:00.000Z").toISOString()
        };
      }
    },
    sync
  };
}

function createTestSyncResult(
  overrides?: Partial<ConnectorSyncResult>
): ConnectorSyncResult {
  return {
    fetchedAt: new Date("2026-04-01T02:55:00.000Z"),
    latestDataAt: new Date("2026-04-01T02:45:00.000Z"),
    segments: [
      {
        segment: "traffic",
        status: "success",
        recordsSynced: 10
      }
    ],
    ...overrides
  };
}

function createTestConnection(
  overrides?: Partial<Parameters<typeof runConnectorSync>[0]["connection"]>
) {
  return {
    id: "ic_test",
    workspaceId: "ws_1",
    propertyId: "prop_1",
    provider: "ga4" as const,
    credentialRef: null,
    freshnessSlaMinutes: 60,
    configJson: null,
    ...overrides
  };
}

function createCapturingLogger() {
  const infoEntries: Array<Record<string, unknown>> = [];
  const errorEntries: Array<Record<string, unknown>> = [];
  const entries: Array<{ level: "info" | "error"; entry: Record<string, unknown> }> = [];

  return {
    entries,
    infoEntries,
    errorEntries,
    logger: {
      info(entry: Record<string, unknown>) {
        infoEntries.push(entry);
        entries.push({ level: "info", entry });
      },
      error(entry: Record<string, unknown>) {
        errorEntries.push(entry);
        entries.push({ level: "error", entry });
      }
    }
  };
}

beforeEach(() => {
  prismaMockFns.connectorSyncRunCreate.mockReset();
  prismaMockFns.integrationConnectionUpdate.mockReset();
  prismaMockFns.dataSourceHealthCreate.mockReset();

  prismaMockFns.connectorSyncRunCreate.mockResolvedValue({});
  prismaMockFns.integrationConnectionUpdate.mockResolvedValue({});
  prismaMockFns.dataSourceHealthCreate.mockResolvedValue({});
});

describe("connector registry", () => {
  it("resolves registered providers and rejects unknown providers", () => {
    const registry = createConnectorRegistry([createGa4Connector()]);

    expect(registry.get("ga4").provider).toBe("ga4");
    expect(() => registry.get("gsc")).toThrowError(/No connector registered/);
  });
});

describe("retry runner", () => {
  it("retries retryable failures and eventually returns success", async () => {
    let attempt = 0;
    const result = await runWithRetry(
      async () => {
        attempt += 1;

        if (attempt < 3) {
          throw new ConnectorExecutionError("transient", {
            code: "RATE_LIMIT",
            retryable: true
          });
        }

        return "ok";
      },
      createRetryPolicy({ maxAttempts: 3, baseDelayMs: 1 })
    );

    expect(result).toBe("ok");
    expect(attempt).toBe(3);
  });

  it("emits observer events for retryable failures", async () => {
    let attempt = 0;
    const events: Array<Record<string, unknown>> = [];

    const result = await runWithRetry(
      async () => {
        attempt += 1;

        if (attempt < 3) {
          throw new ConnectorExecutionError("transient", {
            code: "UPSTREAM_UNAVAILABLE",
            retryable: true
          });
        }

        return "ok";
      },
      createRetryPolicy({ maxAttempts: 3, baseDelayMs: 1 }),
      {
        onEvent(event) {
          events.push(event);
        }
      }
    );

    expect(result).toBe("ok");
    expect(events).toEqual([
      { type: "attempt_started", attempt: 1 },
      {
        type: "attempt_failed",
        attempt: 1,
        code: "UPSTREAM_UNAVAILABLE",
        retryable: true
      },
      {
        type: "retry_scheduled",
        attempt: 1,
        delayMs: 1
      },
      { type: "attempt_started", attempt: 2 },
      {
        type: "attempt_failed",
        attempt: 2,
        code: "UPSTREAM_UNAVAILABLE",
        retryable: true
      },
      {
        type: "retry_scheduled",
        attempt: 2,
        delayMs: 2
      },
      { type: "attempt_started", attempt: 3 }
    ]);
  });

  it("ignores observer failures and keeps retry behavior intact", async () => {
    let attempt = 0;
    const observerCalls: Array<string> = [];

    const result = await runWithRetry(
      async () => {
        attempt += 1;

        if (attempt < 3) {
          throw new ConnectorExecutionError("transient", {
            code: "UPSTREAM_UNAVAILABLE",
            retryable: true
          });
        }

        return "ok";
      },
      createRetryPolicy({ maxAttempts: 3, baseDelayMs: 1 }),
      {
        onEvent(event) {
          observerCalls.push(event.type);

          if (event.type === "attempt_failed") {
            throw new Error("observer failed");
          }
        }
      }
    );

    expect(result).toBe("ok");
    expect(attempt).toBe(3);
    expect(observerCalls).toEqual([
      "attempt_started",
      "attempt_failed",
      "retry_scheduled",
      "attempt_started",
      "attempt_failed",
      "retry_scheduled",
      "attempt_started"
    ]);
  });

  it("ignores async observer rejections and keeps retry behavior intact", async () => {
    let attempt = 0;
    const observerCalls: Array<string> = [];

    const result = await runWithRetry(
      async () => {
        attempt += 1;

        if (attempt < 3) {
          throw new ConnectorExecutionError("transient", {
            code: "UPSTREAM_UNAVAILABLE",
            retryable: true
          });
        }

        return "ok";
      },
      createRetryPolicy({ maxAttempts: 3, baseDelayMs: 1 }),
      {
        async onEvent(event) {
          observerCalls.push(event.type);

          if (event.type === "attempt_failed") {
            await Promise.reject(new Error("observer rejected"));
          }
        }
      }
    );

    expect(result).toBe("ok");
    expect(attempt).toBe(3);
    expect(observerCalls).toEqual([
      "attempt_started",
      "attempt_failed",
      "retry_scheduled",
      "attempt_started",
      "attempt_failed",
      "retry_scheduled",
      "attempt_started"
    ]);
  });

  it("emits a rate_limited event in a real retry path", async () => {
    const events: Array<Record<string, unknown>> = [];
    let attempt = 0;

    const result = await runWithRetry(
      async () => {
        attempt += 1;

        if (attempt === 1) {
          throw new ConnectorExecutionError("slow down", {
            code: "RATE_LIMIT",
            retryable: true
          });
        }

        return "ok";
      },
      createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 }),
      {
        onEvent(event) {
          events.push(event);
        }
      }
    );

    expect(result).toBe("ok");
    expect(attempt).toBe(2);
    expect(events).toEqual([
      { type: "attempt_started", attempt: 1 },
      {
        type: "attempt_failed",
        attempt: 1,
        code: "RATE_LIMIT",
        retryable: true
      },
      {
        type: "rate_limited",
        attempt: 1,
        code: "RATE_LIMIT"
      },
      {
        type: "retry_scheduled",
        attempt: 1,
        delayMs: 1
      },
      { type: "attempt_started", attempt: 2 }
    ]);
  });

  it("does not retry non-retryable failures", async () => {
    let attempt = 0;

    await expect(
      runWithRetry(
        async () => {
          attempt += 1;
          throw new ConnectorExecutionError("bad auth", {
            code: "UNAUTHORIZED",
            retryable: false
          });
        },
        createRetryPolicy({ maxAttempts: 5, baseDelayMs: 1 })
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(attempt).toBe(1);
  });
});

describe("GA4 oauth hooks", () => {
  it("refreshes access token and rotates credentials through the store", async () => {
    const connector = createGa4Connector();
    const store = new InMemoryCredentialStore();

    await store.put({
      reference: "cred-ga4-1",
      workspaceId: "ws_1",
      provider: "ga4",
      payload: {
        refreshToken: "refresh-token",
        accessToken: "expired-token",
        expiresAt: new Date("2026-04-01T00:00:00.000Z").toISOString()
      }
    });

    const rotated = await connector.oauth.refreshAccessToken({
      credentialReference: "cred-ga4-1",
      credentialStore: store,
      now: new Date("2026-04-01T01:00:00.000Z")
    });

    expect(rotated.accessToken).toContain("ga4-token-");

    const updated = await store.get("cred-ga4-1");
    expect(updated?.payload).toMatchObject({
      refreshToken: "refresh-token",
      accessToken: rotated.accessToken
    });
  });
});

describe("sync runner", () => {
  it("stores partial failure with freshness and coverage metadata", async () => {
    const persistence = new InMemorySyncPersistence();
    const connector = createGa4Connector({
      pageMetricsStore: {
        async ingest() {
          return {
            recordsSynced: 1,
            unresolvedPagePaths: ["https://example.com/unresolved"]
          };
        }
      }
    });
    const store = new InMemoryCredentialStore();

    await store.put({
      reference: "cred-ga4-2",
      workspaceId: "ws_1",
      provider: "ga4",
      payload: {
        refreshToken: "refresh-token",
        accessToken: "token",
        expiresAt: new Date("2026-04-01T00:00:00.000Z").toISOString()
      }
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_1",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "ga4",
        credentialRef: "cred-ga4-2",
        freshnessSlaMinutes: 3000,
        configJson: {
          selectedProperty: {
            propertyId: "properties/1234",
            displayName: "Primary property"
          }
        }
      },
      trigger: "schedule",
      now: new Date("2026-03-31T00:30:00.000Z"),
      connector,
      credentialStore: store,
      persistence,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.partialFailure).toBe(true);
    expect(result.coverage.ratio).toBeCloseTo(1 / 2, 3);
    expect(result.freshness.withinSla).toBe(true);

    const latestRun = persistence.getLatestRun("ic_1");
    expect(latestRun?.issues.length).toBe(1);
    expect(latestRun?.issues[0]?.segment).toBe("page-resolution");
  });

  it("records successful-run telemetry and health summaries", async () => {
    const persistence = new InMemorySyncPersistence();
    const store = new InMemoryCredentialStore();
    const { infoEntries, errorEntries, logger } = createCapturingLogger();

    const result = await runConnectorSync({
      connection: createTestConnection({ id: "ic_success" }),
      trigger: "schedule",
      now: new Date("2026-04-01T03:00:00.000Z"),
      connector: createTestConnector(async () =>
        createTestSyncResult({
          latestDataAt: new Date("2026-04-01T02:30:00.000Z"),
          segments: [
            { segment: "traffic", status: "success", recordsSynced: 8 },
            { segment: "pages", status: "success", recordsSynced: 3 }
          ]
        })
      ),
      credentialStore: store,
      persistence,
      logger,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result).toMatchObject({
      status: "success",
      partialFailure: false,
      partialFailureCount: 0,
      stale: false
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.health).toMatchObject({
      status: "success",
      partialFailure: false,
      partialFailureCount: 0,
      issueCount: 0,
      attemptCount: 1,
      retryCount: 0,
      rateLimitCount: 0,
      stale: false,
      withinSla: true,
      coverageRatio: 1,
      expectedSegments: 2,
      succeededSegments: 2,
      missingSegments: []
    });
    expect(result.health.durationMs).toBe(result.durationMs);

    const latestRun = persistence.getLatestRun("ic_success");
    expect(latestRun).toMatchObject({
      partialFailureCount: 0,
      stale: false,
      health: result.health,
      healthMetadataJson: result.health
    });
    expect(latestRun?.durationMs).toBe(result.durationMs);

    expect(infoEntries.map((entry) => entry.event)).toEqual([
      "connector_sync_started",
      "connector_sync_completed"
    ]);
    expect(infoEntries[1]).toMatchObject({
      event: "connector_sync_completed",
      status: "success",
      stale: false,
      partialFailureCount: 0
    });
    expect(errorEntries).toEqual([]);
  });

  it("records partial failures and marks runs stale when no fresh data is available", async () => {
    const persistence = new InMemorySyncPersistence();
    const store = new InMemoryCredentialStore();
    const { infoEntries, logger } = createCapturingLogger();

    const result = await runConnectorSync({
      connection: createTestConnection({ id: "ic_partial" }),
      trigger: "manual",
      now: new Date("2026-04-01T03:00:00.000Z"),
      connector: createTestConnector(async () =>
        createTestSyncResult({
          latestDataAt: null,
          segments: [
            { segment: "traffic", status: "success", recordsSynced: 8 },
            {
              segment: "pages",
              status: "failed",
              code: "UPSTREAM_UNAVAILABLE",
              message: "pages unavailable",
              retryable: true
            }
          ]
        })
      ),
      credentialStore: store,
      persistence,
      logger
    });

    expect(result).toMatchObject({
      status: "partial_failed",
      partialFailure: true,
      partialFailureCount: 1,
      stale: true
    });
    expect(result.health).toMatchObject({
      status: "partial_failed",
      partialFailure: true,
      partialFailureCount: 1,
      issueCount: 1,
      attemptCount: 1,
      retryCount: 0,
      rateLimitCount: 0,
      stale: true,
      withinSla: false,
      coverageRatio: 0.5,
      expectedSegments: 2,
      succeededSegments: 1,
      missingSegments: ["pages"]
    });

    const latestRun = persistence.getLatestRun("ic_partial");
    expect(latestRun).toMatchObject({
      partialFailureCount: 1,
      stale: true,
      health: result.health,
      healthMetadataJson: result.health
    });
    expect(latestRun?.issues).toMatchObject([
      {
        segment: "pages",
        code: "UPSTREAM_UNAVAILABLE",
        message: "pages unavailable",
        retryable: true
      }
    ]);
    expect(infoEntries[1]).toMatchObject({
      event: "connector_sync_completed",
      status: "partial_failed",
      stale: true,
      partialFailureCount: 1
    });
  });

  it("tracks retry counts and rate-limit counts from retry observer events", async () => {
    const persistence = new InMemorySyncPersistence();
    const store = new InMemoryCredentialStore();
    const { infoEntries, errorEntries, logger } = createCapturingLogger();
    let attempt = 0;

    const result = await runConnectorSync({
      connection: createTestConnection({ id: "ic_retry" }),
      trigger: "retry",
      now: new Date("2026-04-01T03:00:00.000Z"),
      connector: createTestConnector(async () => {
        attempt += 1;

        if (attempt === 1) {
          throw new ConnectorExecutionError("slow down", {
            code: "RATE_LIMIT",
            retryable: true
          });
        }

        return createTestSyncResult();
      }),
      credentialStore: store,
      persistence,
      logger,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result.health).toMatchObject({
      attemptCount: 2,
      retryCount: 1,
      rateLimitCount: 1
    });
    expect(infoEntries.map((entry) => entry.event)).toEqual([
      "connector_sync_started",
      "connector_sync_rate_limited",
      "connector_sync_retry_scheduled",
      "connector_sync_completed"
    ]);
    expect(infoEntries[1]).toMatchObject({
      event: "connector_sync_rate_limited",
      attempt: 1,
      code: "RATE_LIMIT"
    });
    expect(infoEntries[2]).toMatchObject({
      event: "connector_sync_retry_scheduled",
      attempt: 1,
      delayMs: 1
    });
    expect(infoEntries[3]).toMatchObject({
      event: "connector_sync_completed",
      attemptCount: 2,
      retryCount: 1,
      rateLimitCount: 1
    });
    expect(errorEntries).toEqual([]);
  });

  it("logs terminal failed status when every returned segment fails", async () => {
    const persistence = new InMemorySyncPersistence();
    const store = new InMemoryCredentialStore();
    const { entries, infoEntries, errorEntries, logger } = createCapturingLogger();

    const result = await runConnectorSync({
      connection: createTestConnection({ id: "ic_failed_result" }),
      trigger: "manual",
      now: new Date("2026-04-01T03:00:00.000Z"),
      connector: createTestConnector(async () =>
        createTestSyncResult({
          latestDataAt: new Date("2026-04-01T02:30:00.000Z"),
          segments: [
            {
              segment: "traffic",
              status: "failed",
              code: "UPSTREAM_UNAVAILABLE",
              message: "traffic unavailable",
              retryable: true
            },
            {
              segment: "pages",
              status: "failed",
              code: "UPSTREAM_UNAVAILABLE",
              message: "pages unavailable",
              retryable: true
            }
          ]
        })
      ),
      credentialStore: store,
      persistence,
      logger
    });

    expect(result.status).toBe("failed");
    expect(result.partialFailure).toBe(false);
    expect(result.partialFailureCount).toBe(0);
    expect(result.health.status).toBe("failed");
    expect(result.health.partialFailure).toBe(false);
    expect(result.health.partialFailureCount).toBe(0);

    const latestRun = persistence.getLatestRun("ic_failed_result");
    expect(latestRun?.status).toBe("failed");
    expect(latestRun?.partialFailure).toBe(false);
    expect(latestRun?.partialFailureCount).toBe(0);
    expect(latestRun?.health.status).toBe("failed");
    expect(latestRun?.health.partialFailureCount).toBe(0);
    expect(latestRun?.healthMetadataJson.status).toBe("failed");
    expect(latestRun?.healthMetadataJson.partialFailureCount).toBe(0);

    expect(infoEntries.map((entry) => entry.event)).toEqual([
      "connector_sync_started",
      "connector_sync_completed"
    ]);
    expect(errorEntries).toEqual([]);
    expect(entries.at(-1)).toMatchObject({
      level: "info",
      entry: {
        event: "connector_sync_completed",
        status: "failed"
      }
    });
  });

  it("persists failed run records for thrown execution failures", async () => {
    const persistence = new InMemorySyncPersistence();
    const store = new InMemoryCredentialStore();
    const { entries, infoEntries, errorEntries, logger } = createCapturingLogger();
    let attempt = 0;

    await expect(
      runConnectorSync({
        connection: createTestConnection({ id: "ic_thrown_failure" }),
        trigger: "retry",
        now: new Date("2026-04-01T03:00:00.000Z"),
        connector: createTestConnector(async () => {
          attempt += 1;
          throw new ConnectorExecutionError("upstream down", {
            code: "UPSTREAM_UNAVAILABLE",
            retryable: true
          });
        }),
        credentialStore: store,
        persistence,
        logger,
        retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
      })
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE"
    });

    expect(attempt).toBe(2);

    const latestRun = persistence.getLatestRun("ic_thrown_failure");
    expect(latestRun).toMatchObject({
      status: "failed",
      partialFailure: false,
      partialFailureCount: 0,
      stale: true
    });
    expect(latestRun?.durationMs).toBeGreaterThanOrEqual(0);
    expect(latestRun?.health).toMatchObject({
      status: "failed",
      partialFailure: false,
      partialFailureCount: 0,
      attemptCount: 2,
      retryCount: 1,
      rateLimitCount: 0,
      stale: true,
      withinSla: false,
      coverageRatio: 0,
      expectedSegments: 0,
      succeededSegments: 0,
      missingSegments: []
    });
    expect(latestRun?.healthMetadataJson).toEqual(latestRun?.health);
    expect(latestRun?.health.durationMs).toBe(latestRun?.durationMs);

    expect(infoEntries.map((entry) => entry.event)).toEqual([
      "connector_sync_started",
      "connector_sync_retry_scheduled"
    ]);
    expect(errorEntries.map((entry) => entry.event)).toEqual([
      "connector_sync_failed"
    ]);
    expect(entries.at(-1)).toMatchObject({
      level: "error",
      entry: {
        event: "connector_sync_failed",
        status: "failed",
        attemptCount: 2,
        retryCount: 1
      }
    });
  });
});

describe("prisma sync persistence", () => {
  it("persists the full normalized health summary on stored runs", async () => {
    const connection = createTestConnection({ id: "ic_prisma_health" });
    const persistence = new PrismaSyncPersistence(connection);
    const runRecord = {
      id: "run_prisma_health",
      integrationConnectionId: connection.id,
      status: "partial_failed" as const,
      partialFailure: true,
      partialFailureCount: 2,
      trigger: "manual" as const,
      startedAt: new Date("2026-04-01T03:00:00.000Z"),
      finishedAt: new Date("2026-04-01T03:00:03.000Z"),
      durationMs: 3000,
      stale: true,
      freshnessMetadataJson: {
        latestDataAt: null,
        checkedAt: "2026-04-01T03:00:00.000Z",
        lagMinutes: null,
        withinSla: false
      },
      coverageMetadataJson: {
        expectedSegments: 3,
        succeededSegments: 1,
        ratio: 1 / 3,
        missingSegments: ["pages", "queries"]
      },
      health: {
        status: "partial_failed" as const,
        partialFailure: true,
        partialFailureCount: 2,
        issueCount: 7,
        attemptCount: 3,
        retryCount: 2,
        rateLimitCount: 1,
        durationMs: 3000,
        stale: true,
        withinSla: false,
        coverageRatio: 1 / 3,
        expectedSegments: 3,
        succeededSegments: 1,
        missingSegments: ["pages", "queries"]
      },
      healthMetadataJson: {
        status: "partial_failed" as const,
        partialFailure: true,
        partialFailureCount: 2,
        issueCount: 7,
        attemptCount: 3,
        retryCount: 2,
        rateLimitCount: 1,
        durationMs: 3000,
        stale: true,
        withinSla: false,
        coverageRatio: 1 / 3,
        expectedSegments: 3,
        succeededSegments: 1,
        missingSegments: ["pages", "queries"]
      },
      issues: [
        {
          segment: "pages",
          code: "UPSTREAM_UNAVAILABLE",
          message: "pages unavailable",
          retryable: true
        }
      ]
    };

    await persistence.writeRun(runRecord);

    expect(prismaMockFns.connectorSyncRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: runRecord.id,
        integrationConnectionId: connection.id,
        healthMetadataJson: runRecord.healthMetadataJson
      })
    });
    expect(prismaMockFns.dataSourceHealthCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        integrationConnectionId: connection.id,
        healthStatus: "partial",
        freshnessScore: 0,
        coverageScore: runRecord.healthMetadataJson.coverageRatio,
        reliabilityScore: 1,
        issueCount: runRecord.healthMetadataJson.issueCount
      })
    });
  });
});

describe("scheduler", () => {
  it("queues GA4 sync when cadence window has elapsed", () => {
    const jobs = buildDueSyncJobs(
      [
        {
          id: "ic_due",
          provider: "ga4",
          configJson: null,
          lastSyncedAt: new Date("2026-04-01T00:00:00.000Z")
        },
        {
          id: "ic_not_due",
          provider: "ga4",
          configJson: null,
          lastSyncedAt: new Date("2026-04-01T03:00:00.000Z")
        }
      ],
      new Date("2026-04-01T06:01:00.000Z")
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.payload.integrationConnectionId).toBe("ic_due");
  });
});
