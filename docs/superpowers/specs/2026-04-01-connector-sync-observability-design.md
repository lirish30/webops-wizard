# Connector Sync Observability Design

## Objective

Extend the worker integration sync framework so each connector sync run produces consistent structured telemetry and richer health metadata. The scope covers:

- structured logging for sync lifecycle events
- job metrics for run outcome and retry behavior
- sync duration tracking
- partial failure counts
- stale connector detection
- rate-limit handling hooks
- per-connector health summaries

This design keeps the implementation inside the existing worker sync framework and existing API health shaping path. It does not introduce a new external metrics backend, queue-level dashboard, or schema migration in this iteration.

## Current Context

The connector framework already centralizes sync execution in:

- `apps/worker/src/domains/integrations/sync/sync-runner.ts`
- `apps/worker/src/domains/integrations/sync/retry.ts`
- `apps/worker/src/domains/integrations/sync/prisma-sync-persistence.ts`
- `apps/worker/src/domains/integrations/sync/connector-sync.service.ts`

Connector modules return segment-level success or failure results plus freshness and optional connection updates. Persistence already writes:

- `ConnectorSyncRun`
- `ConnectorSyncRunIssue`
- `DataSourceHealth`
- connection status fields on `IntegrationConnection`

The main gap is observability breadth. Duration, retry activity, rate limiting, staleness, and connector health rollups are either missing or only inferable indirectly.

## Design Goals

- Keep connector-specific business logic unchanged unless a connector wants to emit richer retryable errors.
- Make `sync-runner.ts` the single place that derives normalized run telemetry.
- Preserve existing status semantics: `success`, `partial_failed`, `failed`.
- Persist richer metadata through existing JSON fields so API and UI can consume it without a schema change.
- Add hooks to retry handling without forcing logging concerns into connector implementations.

## Non-Goals

- exporting metrics to Prometheus, Datadog, or OpenTelemetry
- adding new database columns in this pass
- implementing automatic queue rescheduling or backoff policy changes beyond current retry behavior
- redesigning connector-specific payloads or segment models

## Recommended Approach

Implement a normalized sync observability layer around the existing runner. The runner will collect lifecycle timing, retry events, rate-limit signals, derived counts, and final health summary data. Persistence will store the resulting metadata in `healthMetadataJson`, while the API health helper will expose the new fields as part of last-sync health.

This keeps runtime instrumentation centralized, connector behavior stable, and data shape consistent across all providers.

## Architecture

### 1. Sync Run Telemetry Model

Add an internal telemetry object in `sync-runner.ts` for a single run. It should capture:

- `runId`
- `provider`
- `integrationConnectionId`
- `trigger`
- `startedAt`
- `finishedAt`
- `durationMs`
- `attemptCount`
- `retryCount`
- `rateLimitCount`
- `partialFailureCount`
- `issueCount`
- `stale`
- `status`

The run result returned to callers should also include the high-signal derived fields needed by tests and later callers:

- `durationMs`
- `partialFailureCount`
- `stale`
- `health`

### 2. Structured Logging

Add a narrow logger abstraction for sync execution with JSON-friendly payloads. In this iteration it can default to `console.info` and `console.error`, but the caller-facing interface should make event payloads explicit.

Emit events at:

- `connector_sync_started`
- `connector_sync_retry_scheduled`
- `connector_sync_rate_limited`
- `connector_sync_completed`
- `connector_sync_failed`

Each event should include:

- `runId`
- `provider`
- `integrationConnectionId`
- `workspaceId`
- `propertyId`
- `trigger`
- event-specific fields such as `attempt`, `delayMs`, `errorCode`, `retryable`, `durationMs`

The logger should live at the runner boundary, not inside individual connectors.

### 3. Retry and Rate-Limit Hooks

Extend `runWithRetry` in `retry.ts` to accept optional observer callbacks. The observer should receive enough context to support logging and metrics without changing retry semantics.

Observer events:

- `attempt_started`
- `attempt_failed`
- `retry_scheduled`
- `rate_limited`

`rate_limited` should fire when the thrown error is a retryable `ConnectorExecutionError` with code `RATE_LIMIT`.

This gives the runner a way to count rate-limit events and retries while keeping retry policy implementation separate.

### 4. Duration Tracking

Track duration as `finishedAt - startedAt` in milliseconds. Use the same value for:

- runner return payload
- structured completion log
- persisted health metadata

The system should compute duration regardless of success or failure.

### 5. Partial Failure Counts

The current run status derives from segment outcomes. Add a first-class `partialFailureCount` equal to the number of failed segments.

Behavior:

- `0` for full success
- `> 0` and `< expectedSegments` for partial failures
- `expectedSegments` for total failure if a connector returns segment failures

If the connector throws before returning segments, the count should be `0` because no segment result exists. The top-level failed status still captures the run failure.

### 6. Stale Connector Detection

Compute staleness from freshness metadata and the connection SLA.

Rules:

- if `latestDataAt` is `null`, the run is stale
- if `freshness.withinSla` is `false`, the run is stale
- otherwise, the run is not stale

This `stale` flag should become part of persisted health metadata and API health output.

### 7. Per-Connector Health Summary

Create a normalized health summary object inside `sync-runner.ts` and persist it into `healthMetadataJson`.

Proposed shape:

```ts
{
  status: "success" | "partial_failed" | "failed",
  partialFailure: boolean,
  partialFailureCount: number,
  issueCount: number,
  attemptCount: number,
  retryCount: number,
  rateLimitCount: number,
  durationMs: number,
  stale: boolean,
  withinSla: boolean,
  coverageRatio: number,
  expectedSegments: number,
  succeededSegments: number,
  missingSegments: string[]
}
```

This object becomes the stable summary shape consumed by API health builders and later UI summary cards.

### 8. Persistence Changes

Update `PrismaSyncPersistence.writeRun` to write the full health summary into `healthMetadataJson` instead of the current minimal object.

Connection status updates remain:

- `connected` for success
- `warning` for partial failures
- `error` for failures

`DataSourceHealth` writing remains structurally the same, but it should derive issue count from the richer run record and continue using freshness and coverage outputs.

### 9. API Health Exposure

Update `apps/api/src/domains/integrations/integrations.health.ts` so the last-sync health object includes parsed `healthMetadataJson` in addition to freshness and coverage.

This allows the API surface to return a single per-connector summary that includes:

- staleness
- duration
- retries
- rate-limit events
- partial failure count

The helper should remain defensive and treat malformed JSON as `null`.

## Error Handling

### Connectors Returning Segment Results

When a connector returns a mix of successes and failures:

- derive `partialFailureCount` from failed segments
- derive `status` as `partial_failed` when some segments succeed
- log completion as a completed run, not as an uncaught failure

### Connector Throws Before Producing a Result

When `connector.sync` throws:

- retry handling decides whether to retry
- runner logs retry and rate-limit events through observers
- final uncaught failure is logged as `connector_sync_failed`
- a failed run record is still persisted with zero coverage and zero segment failures unless the implementation explicitly normalizes the exception into an issue record

The implementation should keep current failure behavior intact while ensuring observability fields still exist.

## Testing Strategy

Follow TDD and cover the behavior at the worker framework level.

Add tests in `apps/worker/src/domains/integrations/connector-framework.test.ts` for:

- duration is tracked on successful runs
- partial failure count reflects failed segments
- stale is true when no data is returned or freshness misses SLA
- retry observer counts retries
- rate-limit observer counts `RATE_LIMIT` failures
- persisted health metadata contains the normalized per-connector summary

Add focused tests in `apps/api/src/domains/integrations/integrations.health.test.ts` for:

- health helper returns parsed health summary when present
- malformed health JSON safely returns `null`

Use minimal fake connectors and in-memory persistence for runner tests. Avoid coupling tests to console output by injecting a logger spy interface.

## Implementation Plan Shape

The implementation should proceed in this order:

1. Add failing tests for runner result fields and persisted health metadata.
2. Add failing tests for retry observer events and rate-limit counting.
3. Implement runner telemetry model and structured logger interface.
4. Implement retry observer support.
5. Persist richer health metadata.
6. Expose health summary through the API helper.
7. Run targeted worker and API tests.

## Trade-Offs

### Why JSON Metadata Instead of New Columns

Using existing JSON fields keeps the change small, avoids a migration, and lets the product validate the health-summary shape before freezing it into schema. The trade-off is weaker queryability at the database layer, which is acceptable for this iteration because the current requirement is operational observability and API exposure, not analytics-grade aggregation.

### Why Centralize in the Runner

The runner is the only place that sees connector context, retry behavior, timing boundaries, and final segment outcomes together. Centralizing there avoids repeated logic across connectors and keeps health summaries uniform.

## Success Criteria

The change is complete when:

- every connector sync run emits structured lifecycle logs
- run results include duration, stale flag, and partial failure count
- retry and rate-limit events are observable through hooks
- health metadata persists per-connector summary fields
- API health shaping exposes the summary
- targeted tests cover the added behavior
