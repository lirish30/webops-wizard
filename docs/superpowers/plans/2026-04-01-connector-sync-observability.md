# Connector Sync Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured sync logging, retry and rate-limit hooks, duration and stale tracking, partial failure counts, and persisted per-connector health summaries to the worker sync framework and API health helper.

**Architecture:** Keep the change centered in the existing connector sync framework. Extend the retry runner to emit observer events, extend the sync runner to derive normalized telemetry and health summary data, persist the richer health summary through existing JSON fields, and expose that summary through the API health shaping helper.

**Tech Stack:** TypeScript, Vitest, Prisma, worker connector framework

---

## File Structure

- Modify: `apps/worker/src/domains/integrations/sync/retry.ts`
  Adds retry observer types and hook dispatch for attempts, scheduled retries, and rate-limit events.
- Modify: `apps/worker/src/domains/integrations/sync/sync-runner.ts`
  Derives run telemetry, emits structured logs, tracks duration and staleness, and returns normalized health summary data.
- Modify: `apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts`
  Persists richer `healthMetadataJson` and uses the expanded run record shape.
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
  Covers retry observers, duration, partial failure counts, stale detection, and normalized health summaries.
- Modify: `apps/api/src/domains/integrations/integrations.health.ts`
  Adds parsed `health` summary output to last-sync health responses.
- Modify: `apps/api/src/domains/integrations/integrations.health.test.ts`
  Covers health summary parsing and malformed JSON handling.

### Task 1: Add Failing Retry Observer Tests

**Files:**
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Modify: `apps/worker/src/domains/integrations/sync/retry.ts`
- Test: `apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Write the failing retry observer test**

```ts
it("emits retry observer events for retryable failures", async () => {
  const events: Array<Record<string, unknown>> = [];
  let attempt = 0;

  const result = await runWithRetry(
    async () => {
      attempt += 1;

      if (attempt < 3) {
        throw new ConnectorExecutionError("temporary failure", {
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
    expect.objectContaining({ type: "attempt_started", attempt: 1 }),
    expect.objectContaining({ type: "attempt_failed", attempt: 1, code: "UPSTREAM_UNAVAILABLE" }),
    expect.objectContaining({ type: "retry_scheduled", attempt: 1, nextAttempt: 2, delayMs: 1 }),
    expect.objectContaining({ type: "attempt_started", attempt: 2 }),
    expect.objectContaining({ type: "attempt_failed", attempt: 2, code: "UPSTREAM_UNAVAILABLE" }),
    expect.objectContaining({ type: "retry_scheduled", attempt: 2, nextAttempt: 3, delayMs: 2 }),
    expect.objectContaining({ type: "attempt_started", attempt: 3 })
  ]);
});
```

- [ ] **Step 2: Write the failing rate-limit observer test**

```ts
it("emits a dedicated rate-limited event for retryable rate-limit failures", async () => {
  const events: Array<Record<string, unknown>> = [];

  await expect(
    runWithRetry(
      async () => {
        throw new ConnectorExecutionError("slow down", {
          code: "RATE_LIMIT",
          retryable: true
        });
      },
      createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 }),
      {
        onEvent(event) {
          events.push(event);
        }
      }
    )
  ).rejects.toMatchObject({ code: "RATE_LIMIT" });

  expect(events).toContainEqual(
    expect.objectContaining({ type: "rate_limited", attempt: 1, code: "RATE_LIMIT" })
  );
});
```

- [ ] **Step 3: Run the worker framework tests to verify red state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: FAIL because `runWithRetry` does not accept an observer argument and no retry event objects exist yet.

- [ ] **Step 4: Implement the minimal retry observer types**

```ts
export type RetryObserverEvent =
  | { type: "attempt_started"; attempt: number }
  | { type: "attempt_failed"; attempt: number; code: string; retryable: boolean }
  | { type: "retry_scheduled"; attempt: number; nextAttempt: number; delayMs: number }
  | { type: "rate_limited"; attempt: number; code: "RATE_LIMIT" };

export interface RetryObserver {
  onEvent(event: RetryObserverEvent): void;
}
```

- [ ] **Step 5: Implement observer dispatch inside `runWithRetry`**

```ts
export async function runWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  observer?: RetryObserver
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    observer?.onEvent({ type: "attempt_started", attempt });

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code =
        error instanceof ConnectorExecutionError ? error.code : "UNKNOWN";
      const retryable = isRetryableError(error);

      observer?.onEvent({ type: "attempt_failed", attempt, code, retryable });

      if (error instanceof ConnectorExecutionError && error.code === "RATE_LIMIT" && retryable) {
        observer?.onEvent({ type: "rate_limited", attempt, code: "RATE_LIMIT" });
      }

      if (!retryable || attempt >= policy.maxAttempts) {
        throw error;
      }

      const delayMs = policy.baseDelayMs * attempt;
      observer?.onEvent({
        type: "retry_scheduled",
        attempt,
        nextAttempt: attempt + 1,
        delayMs
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
```

- [ ] **Step 6: Run the worker framework tests to verify green state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: PASS for the new retry observer tests and existing retry behavior tests.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/domains/integrations/connector-framework.test.ts apps/worker/src/domains/integrations/sync/retry.ts
git commit -m "test: add retry observer hooks for connector sync"
```

### Task 2: Add Failing Sync Runner Observability Tests

**Files:**
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Modify: `apps/worker/src/domains/integrations/sync/sync-runner.ts`
- Test: `apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Write the failing successful-run telemetry test**

```ts
it("returns duration, stale flag, and normalized health summary for successful runs", async () => {
  const persistence = new InMemorySyncPersistence();
  const logEvents: Array<Record<string, unknown>> = [];

  const connector: ConnectorModule = {
    provider: "ga4",
    oauth: {
      async refreshAccessToken() {
        throw new Error("not used");
      }
    },
    async sync() {
      return {
        fetchedAt: new Date("2026-04-01T03:00:05.000Z"),
        latestDataAt: new Date("2026-04-01T02:45:00.000Z"),
        segments: [{ segment: "traffic", status: "success", recordsSynced: 5 }]
      };
    }
  };

  const result = await runConnectorSync({
    connection: {
      id: "ic_success",
      workspaceId: "ws_1",
      propertyId: "prop_1",
      provider: "ga4",
      credentialRef: "cred_1",
      freshnessSlaMinutes: 60,
      configJson: null
    },
    trigger: "schedule",
    now: new Date("2026-04-01T03:00:00.000Z"),
    connector,
    credentialStore: new InMemoryCredentialStore(),
    persistence,
    logger: {
      info(event) {
        logEvents.push(event);
      },
      error(event) {
        logEvents.push(event);
      }
    }
  });

  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(result.partialFailureCount).toBe(0);
  expect(result.stale).toBe(false);
  expect(result.health).toMatchObject({
    status: "success",
    partialFailureCount: 0,
    retryCount: 0,
    rateLimitCount: 0,
    stale: false,
    withinSla: true,
    coverageRatio: 1
  });
  expect(logEvents).toContainEqual(
    expect.objectContaining({ event: "connector_sync_completed", provider: "ga4" })
  );
});
```

- [ ] **Step 2: Write the failing partial-failure and stale detection test**

```ts
it("counts failed segments and marks runs stale when freshness misses SLA", async () => {
  const persistence = new InMemorySyncPersistence();

  const connector: ConnectorModule = {
    provider: "sitemap",
    oauth: {
      async refreshAccessToken() {
        throw new Error("not used");
      }
    },
    async sync() {
      return {
        fetchedAt: new Date("2026-04-01T06:00:05.000Z"),
        latestDataAt: new Date("2026-04-01T03:00:00.000Z"),
        segments: [
          { segment: "pages", status: "success", recordsSynced: 10 },
          {
            segment: "images",
            status: "failed",
            code: "UPSTREAM_TIMEOUT",
            message: "image fetch timed out",
            retryable: true
          }
        ]
      };
    }
  };

  const result = await runConnectorSync({
    connection: {
      id: "ic_partial",
      workspaceId: "ws_1",
      propertyId: "prop_1",
      provider: "sitemap",
      credentialRef: null,
      freshnessSlaMinutes: 30,
      configJson: null
    },
    trigger: "schedule",
    now: new Date("2026-04-01T06:00:00.000Z"),
    connector,
    credentialStore: new InMemoryCredentialStore(),
    persistence
  });

  expect(result.status).toBe("partial_failed");
  expect(result.partialFailureCount).toBe(1);
  expect(result.stale).toBe(true);
  expect(result.health).toMatchObject({
    partialFailureCount: 1,
    issueCount: 1,
    stale: true,
    withinSla: false,
    expectedSegments: 2,
    succeededSegments: 1,
    missingSegments: ["images"]
  });
});
```

- [ ] **Step 3: Write the failing retry-count and rate-limit-count test**

```ts
it("tracks retry and rate-limit counts in the health summary", async () => {
  const persistence = new InMemorySyncPersistence();
  let attempts = 0;

  const connector: ConnectorModule = {
    provider: "gsc",
    oauth: {
      async refreshAccessToken() {
        throw new Error("not used");
      }
    },
    async sync() {
      attempts += 1;

      if (attempts === 1) {
        throw new ConnectorExecutionError("rate limited", {
          code: "RATE_LIMIT",
          retryable: true
        });
      }

      return {
        fetchedAt: new Date("2026-04-01T06:10:05.000Z"),
        latestDataAt: new Date("2026-04-01T06:00:00.000Z"),
        segments: [{ segment: "queries", status: "success", recordsSynced: 25 }]
      };
    }
  };

  const result = await runConnectorSync({
    connection: {
      id: "ic_retry",
      workspaceId: "ws_1",
      propertyId: "prop_1",
      provider: "gsc",
      credentialRef: "cred_1",
      freshnessSlaMinutes: 30,
      configJson: null
    },
    trigger: "retry",
    now: new Date("2026-04-01T06:10:00.000Z"),
    connector,
    credentialStore: new InMemoryCredentialStore(),
    persistence,
    retryPolicy: createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 })
  });

  expect(result.health).toMatchObject({
    attemptCount: 2,
    retryCount: 1,
    rateLimitCount: 1
  });
});
```

- [ ] **Step 4: Run the worker framework tests to verify red state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: FAIL because `runConnectorSync` does not yet expose `durationMs`, `partialFailureCount`, `stale`, `health`, or structured logger support.

- [ ] **Step 5: Add the run health summary types to `sync-runner.ts`**

```ts
export interface ConnectorRunHealthSummary {
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  partialFailureCount: number;
  issueCount: number;
  attemptCount: number;
  retryCount: number;
  rateLimitCount: number;
  durationMs: number;
  stale: boolean;
  withinSla: boolean;
  coverageRatio: number;
  expectedSegments: number;
  succeededSegments: number;
  missingSegments: string[];
}
```

- [ ] **Step 6: Extend the runner result and record shapes**

```ts
export interface ConnectorSyncRunRecord {
  id: string;
  integrationConnectionId: string;
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  partialFailureCount: number;
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  freshnessMetadataJson: FreshnessMetadata;
  coverageMetadataJson: CoverageMetadata;
  healthMetadataJson: ConnectorRunHealthSummary;
  issues: ConnectorSyncRunIssueRecord[];
  connectionUpdates?: {
    configJson?: Record<string, unknown> | null;
  };
}

export interface RunConnectorSyncResult {
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  partialFailureCount: number;
  durationMs: number;
  stale: boolean;
  freshness: FreshnessMetadata;
  coverage: CoverageMetadata;
  health: ConnectorRunHealthSummary;
  issues: ConnectorSyncRunIssueRecord[];
}
```

- [ ] **Step 7: Implement the minimal structured logger interface**

```ts
export interface SyncLogger {
  info(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
}

const defaultSyncLogger: SyncLogger = {
  info(event) {
    console.info(JSON.stringify(event));
  },
  error(event) {
    console.error(JSON.stringify(event));
  }
};
```

- [ ] **Step 8: Implement telemetry collection in `runConnectorSync`**

```ts
const counters = {
  attemptCount: 0,
  retryCount: 0,
  rateLimitCount: 0
};

const logger = input.logger ?? defaultSyncLogger;
logger.info({
  event: "connector_sync_started",
  runId,
  provider: input.connection.provider,
  integrationConnectionId: input.connection.id,
  workspaceId: input.connection.workspaceId,
  propertyId: input.connection.propertyId,
  trigger: input.trigger
});

const syncResult = await runWithRetry(
  () =>
    input.connector.sync({
      connection: input.connection,
      now: input.now,
      credentialStore: input.credentialStore
    }),
  policy,
  {
    onEvent(event) {
      if (event.type === "attempt_started") {
        counters.attemptCount = Math.max(counters.attemptCount, event.attempt);
      }

      if (event.type === "retry_scheduled") {
        counters.retryCount += 1;
        logger.info({
          event: "connector_sync_retry_scheduled",
          runId,
          provider: input.connection.provider,
          integrationConnectionId: input.connection.id,
          attempt: event.attempt,
          nextAttempt: event.nextAttempt,
          delayMs: event.delayMs
        });
      }

      if (event.type === "rate_limited") {
        counters.rateLimitCount += 1;
        logger.info({
          event: "connector_sync_rate_limited",
          runId,
          provider: input.connection.provider,
          integrationConnectionId: input.connection.id,
          attempt: event.attempt,
          errorCode: event.code
        });
      }
    }
  }
);
```

- [ ] **Step 9: Implement duration, partial-failure count, stale detection, and health summary derivation**

```ts
const finishedAt = new Date();
const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
const partialFailureCount = syncResult.segments.filter(
  (segment) => segment.status === "failed"
).length;
const stale = !freshness.withinSla || freshness.latestDataAt === null;

const health: ConnectorRunHealthSummary = {
  status,
  partialFailure: status === "partial_failed",
  partialFailureCount,
  issueCount: issues.length,
  attemptCount: counters.attemptCount || 1,
  retryCount: counters.retryCount,
  rateLimitCount: counters.rateLimitCount,
  durationMs,
  stale,
  withinSla: freshness.withinSla,
  coverageRatio: coverage.ratio,
  expectedSegments: coverage.expectedSegments,
  succeededSegments: coverage.succeededSegments,
  missingSegments: coverage.missingSegments
};
```

- [ ] **Step 10: Implement completion and failure log events**

```ts
logger.info({
  event: "connector_sync_completed",
  runId,
  provider: input.connection.provider,
  integrationConnectionId: input.connection.id,
  trigger: input.trigger,
  status,
  durationMs,
  partialFailureCount,
  retryCount: health.retryCount,
  rateLimitCount: health.rateLimitCount,
  stale
});
```

```ts
logger.error({
  event: "connector_sync_failed",
  runId,
  provider: input.connection.provider,
  integrationConnectionId: input.connection.id,
  trigger: input.trigger,
  durationMs,
  errorCode,
  message
});
```

- [ ] **Step 11: Run the worker framework tests to verify green state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: PASS with the new observability assertions.

- [ ] **Step 12: Commit**

```bash
git add apps/worker/src/domains/integrations/connector-framework.test.ts apps/worker/src/domains/integrations/sync/sync-runner.ts
git commit -m "feat: add connector sync telemetry and health summaries"
```

### Task 3: Persist the Normalized Health Summary

**Files:**
- Modify: `apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts`
- Modify: `apps/worker/src/domains/integrations/sync/sync-runner.ts`
- Test: `apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Write the failing persistence-shape assertion**

```ts
it("stores the normalized health summary on persisted sync runs", async () => {
  const persistence = new InMemorySyncPersistence();

  const connector: ConnectorModule = {
    provider: "ga4",
    oauth: {
      async refreshAccessToken() {
        throw new Error("not used");
      }
    },
    async sync() {
      return {
        fetchedAt: new Date("2026-04-01T08:00:05.000Z"),
        latestDataAt: null,
        segments: [{ segment: "traffic", status: "success", recordsSynced: 4 }]
      };
    }
  };

  await runConnectorSync({
    connection: {
      id: "ic_health_json",
      workspaceId: "ws_1",
      propertyId: "prop_1",
      provider: "ga4",
      credentialRef: "cred_1",
      freshnessSlaMinutes: 60,
      configJson: null
    },
    trigger: "manual",
    now: new Date("2026-04-01T08:00:00.000Z"),
    connector,
    credentialStore: new InMemoryCredentialStore(),
    persistence
  });

  expect(persistence.getLatestRun("ic_health_json")?.healthMetadataJson).toMatchObject({
    status: "success",
    stale: true,
    partialFailureCount: 0,
    issueCount: 0
  });
});
```

- [ ] **Step 2: Run the worker framework tests to verify red state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: FAIL because the in-memory run record and Prisma persistence do not yet require `healthMetadataJson`.

- [ ] **Step 3: Update `InMemorySyncPersistence` to retain the new run shape**

```ts
writeRun(run: ConnectorSyncRunRecord): Promise<void> {
  const existing = this.runs.get(run.integrationConnectionId) ?? [];
  existing.push(run);
  this.runs.set(run.integrationConnectionId, existing);
  return Promise.resolve();
}
```

- [ ] **Step 4: Write the Prisma health metadata using the expanded run record**

```ts
healthMetadataJson: toInputJson(run.healthMetadataJson),
```

- [ ] **Step 5: Keep `DataSourceHealth` aligned with the richer run record**

```ts
issueCount: run.healthMetadataJson.issueCount,
freshnessScore: run.freshnessMetadataJson.withinSla ? 1 : 0,
coverageScore: run.coverageMetadataJson.ratio,
reliabilityScore: run.status === "failed" ? 0 : 1,
```

- [ ] **Step 6: Run the worker framework tests to verify green state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: PASS with persisted health metadata assertions.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts apps/worker/src/domains/integrations/sync/sync-runner.ts apps/worker/src/domains/integrations/connector-framework.test.ts
git commit -m "feat: persist connector sync health summaries"
```

### Task 4: Expose Health Summary Through the API Helper

**Files:**
- Modify: `apps/api/src/domains/integrations/integrations.health.ts`
- Modify: `apps/api/src/domains/integrations/integrations.health.test.ts`
- Test: `apps/api/src/domains/integrations/integrations.health.test.ts`

- [ ] **Step 1: Write the failing API health summary parsing test**

```ts
it("returns parsed health summary metadata when present", () => {
  const run: LatestSyncRunLike = {
    startedAt: new Date("2026-04-01T01:00:00.000Z"),
    status: "partial_failed",
    partialFailure: true,
    freshnessMetadataJson: {
      lagMinutes: 15,
      withinSla: true
    },
    coverageMetadataJson: {
      ratio: 0.66,
      missingSegments: ["conversions"]
    },
    healthMetadataJson: {
      partialFailureCount: 1,
      retryCount: 2,
      rateLimitCount: 1,
      stale: false,
      durationMs: 5000
    }
  };

  const health = buildLastSyncHealth({
    lastSuccessAt: new Date("2026-04-01T00:58:00.000Z"),
    lastErrorAt: new Date("2026-04-01T00:59:00.000Z"),
    lastErrorMessage: "Conversions stream timed out",
    latestRun: run
  });

  expect(health?.health).toMatchObject({
    partialFailureCount: 1,
    retryCount: 2,
    rateLimitCount: 1,
    stale: false,
    durationMs: 5000
  });
});
```

- [ ] **Step 2: Write the failing malformed-health-json test**

```ts
it("returns null health summary when health metadata is malformed", () => {
  const run: LatestSyncRunLike = {
    startedAt: new Date("2026-04-01T01:00:00.000Z"),
    status: "success",
    partialFailure: false,
    freshnessMetadataJson: {},
    coverageMetadataJson: {},
    healthMetadataJson: "not-an-object"
  };

  const health = buildLastSyncHealth({
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    latestRun: run
  });

  expect(health?.health).toBeNull();
});
```

- [ ] **Step 3: Run the API health tests to verify red state**

Run: `pnpm --filter @webops-wizard/api test -- --run apps/api/src/domains/integrations/integrations.health.test.ts`

Expected: FAIL because `LatestSyncRunLike` and `LastSyncHealth` do not yet include `healthMetadataJson` or `health`.

- [ ] **Step 4: Extend the API health types**

```ts
export interface LatestSyncRunLike {
  startedAt: Date;
  status: "running" | "success" | "partial_failed" | "failed" | "retriable_failed";
  partialFailure: boolean;
  freshnessMetadataJson: unknown;
  coverageMetadataJson: unknown;
  healthMetadataJson: unknown;
}

export interface LastSyncHealth {
  status: LatestSyncRunLike["status"];
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  partialFailure: boolean;
  lastError: {
    at: string;
    message: string;
  } | null;
  freshness: Record<string, unknown> | null;
  coverage: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
}
```

- [ ] **Step 5: Parse the persisted health summary**

```ts
return {
  status: input.latestRun.status,
  lastAttemptAt: input.latestRun.startedAt.toISOString(),
  lastSuccessAt: input.lastSuccessAt?.toISOString() ?? null,
  partialFailure: input.latestRun.partialFailure,
  lastError:
    input.lastErrorAt && input.lastErrorMessage
      ? {
          at: input.lastErrorAt.toISOString(),
          message: input.lastErrorMessage
        }
      : null,
  freshness: asRecord(input.latestRun.freshnessMetadataJson),
  coverage: asRecord(input.latestRun.coverageMetadataJson),
  health: asRecord(input.latestRun.healthMetadataJson)
};
```

- [ ] **Step 6: Run the API health tests to verify green state**

Run: `pnpm --filter @webops-wizard/api test -- --run apps/api/src/domains/integrations/integrations.health.test.ts`

Expected: PASS with the new summary parsing behavior.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/domains/integrations/integrations.health.ts apps/api/src/domains/integrations/integrations.health.test.ts
git commit -m "feat: expose connector sync health summaries in api responses"
```

### Task 5: Run Final Verification

**Files:**
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Modify: `apps/worker/src/domains/integrations/sync/retry.ts`
- Modify: `apps/worker/src/domains/integrations/sync/sync-runner.ts`
- Modify: `apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts`
- Modify: `apps/api/src/domains/integrations/integrations.health.ts`
- Modify: `apps/api/src/domains/integrations/integrations.health.test.ts`

- [ ] **Step 1: Run the targeted worker tests**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

Expected: PASS

- [ ] **Step 2: Run the targeted API health tests**

Run: `pnpm --filter @webops-wizard/api test -- --run apps/api/src/domains/integrations/integrations.health.test.ts`

Expected: PASS

- [ ] **Step 3: Run both targeted suites together for fresh evidence**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts && pnpm --filter @webops-wizard/api test -- --run apps/api/src/domains/integrations/integrations.health.test.ts`

Expected: both commands exit 0

- [ ] **Step 4: Commit the final integrated change**

```bash
git add apps/worker/src/domains/integrations/connector-framework.test.ts apps/worker/src/domains/integrations/sync/retry.ts apps/worker/src/domains/integrations/sync/sync-runner.ts apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts apps/api/src/domains/integrations/integrations.health.ts apps/api/src/domains/integrations/integrations.health.test.ts
git commit -m "feat: add connector sync observability"
```
