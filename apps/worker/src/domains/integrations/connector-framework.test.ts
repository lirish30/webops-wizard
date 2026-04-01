import { describe, expect, it } from "vitest";

import { InMemoryCredentialStore } from "./credentials/in-memory-credential-store";
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
import { buildDueSyncJobs } from "./sync/scheduler";

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

  it("emits a rate_limited event for retryable rate limit failures", async () => {
    const events: Array<Record<string, unknown>> = [];

    await expect(
      runWithRetry(
        async () => {
          throw new ConnectorExecutionError("slow down", {
            code: "RATE_LIMIT",
            retryable: true
          });
        },
        createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 }),
        {
          onEvent(event) {
            events.push(event);
          }
        }
      )
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });

    expect(events).toContainEqual({
      type: "rate_limited",
      attempt: 1,
      code: "RATE_LIMIT"
    });
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
    const connector = createGa4Connector();
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
        freshnessSlaMinutes: 60,
        configJson: {
          ga4PropertyId: "1234",
          simulatedFailureSegments: ["conversions"]
        }
      },
      trigger: "schedule",
      now: new Date("2026-04-01T03:00:00.000Z"),
      connector,
      credentialStore: store,
      persistence,
      retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.partialFailure).toBe(true);
    expect(result.coverage.ratio).toBeCloseTo(2 / 3, 3);
    expect(result.freshness.withinSla).toBe(true);

    const latestRun = persistence.getLatestRun("ic_1");
    expect(latestRun?.issues.length).toBe(1);
    expect(latestRun?.issues[0]?.segment).toBe("conversions");
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
