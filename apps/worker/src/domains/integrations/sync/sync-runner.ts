import { randomUUID } from "node:crypto";

import type {
  ConnectorConnectionContext,
  ConnectorModule,
  CoverageMetadata,
  FreshnessMetadata,
  SyncTrigger
} from "../connectors/connector.types";
import type { CredentialStore } from "../credentials/credential-store";

import {
  createRetryPolicy,
  type RetryPolicy,
  type RetryObserver,
  runWithRetry
} from "./retry";

export type ConnectorSyncRunStatus =
  | "success"
  | "partial_failed"
  | "failed";

export interface ConnectorSyncRunIssueRecord {
  segment: string;
  code: string;
  message: string;
  retryable: boolean;
}

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

export interface StructuredLogger {
  info(entry: Record<string, unknown>): void;
  error(entry: Record<string, unknown>): void;
}

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
  stale: boolean;
  freshnessMetadataJson: FreshnessMetadata;
  coverageMetadataJson: CoverageMetadata;
  health: ConnectorRunHealthSummary;
  healthMetadataJson: ConnectorRunHealthSummary;
  issues: ConnectorSyncRunIssueRecord[];
  connectionUpdates?: {
    configJson?: Record<string, unknown> | null;
  };
}

export interface SyncPersistence {
  writeRun(run: ConnectorSyncRunRecord): Promise<void>;
}

export class InMemorySyncPersistence implements SyncPersistence {
  private readonly runs = new Map<string, ConnectorSyncRunRecord[]>();

  writeRun(run: ConnectorSyncRunRecord): Promise<void> {
    const existing = this.runs.get(run.integrationConnectionId) ?? [];
    existing.push(run);
    this.runs.set(run.integrationConnectionId, existing);
    return Promise.resolve();
  }

  getLatestRun(integrationConnectionId: string): ConnectorSyncRunRecord | null {
    const runs = this.runs.get(integrationConnectionId) ?? [];
    return runs.at(-1) ?? null;
  }
}

export interface RunConnectorSyncInput {
  connection: ConnectorConnectionContext;
  trigger: SyncTrigger;
  now: Date;
  runId?: string;
  connector: ConnectorModule;
  credentialStore: CredentialStore;
  persistence: SyncPersistence;
  retryPolicy?: RetryPolicy;
  logger?: StructuredLogger;
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

const defaultStructuredLogger: StructuredLogger = {
  info(entry) {
    console.info(JSON.stringify(entry));
  },
  error(entry) {
    console.error(JSON.stringify(entry));
  }
};

function computeCoverage(
  segmentStatuses: Array<{ segment: string; status: "success" | "failed" }>
): CoverageMetadata {
  const expectedSegments = segmentStatuses.length;
  const succeededSegments = segmentStatuses.filter(
    (segment) => segment.status === "success"
  ).length;
  const missingSegments = segmentStatuses
    .filter((segment) => segment.status === "failed")
    .map((segment) => segment.segment);

  return {
    expectedSegments,
    succeededSegments,
    ratio: expectedSegments === 0 ? 1 : succeededSegments / expectedSegments,
    missingSegments
  };
}

function computeFreshness(input: {
  latestDataAt: Date | null;
  now: Date;
  freshnessSlaMinutes: number | null;
}): FreshnessMetadata {
  const lagMinutes = input.latestDataAt
    ? Math.max(0, Math.floor((input.now.getTime() - input.latestDataAt.getTime()) / 60000))
    : null;
  const slaMinutes = input.freshnessSlaMinutes ?? Number.POSITIVE_INFINITY;

  return {
    latestDataAt: input.latestDataAt?.toISOString() ?? null,
    checkedAt: input.now.toISOString(),
    lagMinutes,
    withinSla: lagMinutes === null ? false : lagMinutes <= slaMinutes
  };
}

function deriveStatus(input: {
  succeededSegments: number;
  expectedSegments: number;
}): ConnectorSyncRunStatus {
  if (input.succeededSegments === input.expectedSegments) {
    return "success";
  }

  if (input.succeededSegments === 0) {
    return "failed";
  }

  return "partial_failed";
}

function computeDurationMs(
  executionStartedAtMs: number,
  executionFinishedAtMs: number
): number {
  return Math.max(0, executionFinishedAtMs - executionStartedAtMs);
}

function deriveStale(input: {
  latestDataAt: Date | null;
  freshness: FreshnessMetadata;
}): boolean {
  return input.latestDataAt === null || input.freshness.withinSla === false;
}

function deriveHealthSummary(input: {
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  partialFailureCount: number;
  attemptCount: number;
  retryCount: number;
  rateLimitCount: number;
  durationMs: number;
  stale: boolean;
  freshness: FreshnessMetadata;
  coverage: CoverageMetadata;
  issues: ConnectorSyncRunIssueRecord[];
}): ConnectorRunHealthSummary {
  return {
    status: input.status,
    partialFailure: input.partialFailure,
    partialFailureCount: input.partialFailureCount,
    issueCount: input.issues.length,
    attemptCount: input.attemptCount,
    retryCount: input.retryCount,
    rateLimitCount: input.rateLimitCount,
    durationMs: input.durationMs,
    stale: input.stale,
    withinSla: input.freshness.withinSla,
    coverageRatio: input.coverage.ratio,
    expectedSegments: input.coverage.expectedSegments,
    succeededSegments: input.coverage.succeededSegments,
    missingSegments: input.coverage.missingSegments
  };
}

function safeInfo(
  logger: StructuredLogger,
  entry: Record<string, unknown>
): void {
  try {
    logger.info(entry);
  } catch {
    // Observability must not alter sync execution semantics.
  }
}

function safeError(
  logger: StructuredLogger,
  entry: Record<string, unknown>
): void {
  try {
    logger.error(entry);
  } catch {
    // Observability must not alter sync execution semantics.
  }
}

export async function runConnectorSync(
  input: RunConnectorSyncInput
): Promise<RunConnectorSyncResult> {
  const startedAt = input.now;
  const logger = input.logger ?? defaultStructuredLogger;
  const runId = input.runId ?? randomUUID();
  const executionStartedAtMs = Date.now();
  const retryTelemetry = {
    attemptCount: 0,
    retryCount: 0,
    rateLimitCount: 0
  };

  const policy = input.retryPolicy ?? createRetryPolicy();
  const logContext = {
    runId,
    integrationConnectionId: input.connection.id,
    workspaceId: input.connection.workspaceId,
    provider: input.connection.provider,
    trigger: input.trigger
  };

  const retryObserver: RetryObserver = {
    onEvent(event) {
      switch (event.type) {
        case "attempt_started":
          retryTelemetry.attemptCount = event.attempt;
          break;
        case "retry_scheduled":
          retryTelemetry.retryCount += 1;
          safeInfo(logger, {
            event: "connector_sync_retry_scheduled",
            ...logContext,
            attempt: event.attempt,
            delayMs: event.delayMs
          });
          break;
        case "rate_limited":
          retryTelemetry.rateLimitCount += 1;
          safeInfo(logger, {
            event: "connector_sync_rate_limited",
            ...logContext,
            attempt: event.attempt,
            code: event.code
          });
          break;
        default:
          break;
      }
    }
  };

  safeInfo(logger, {
    event: "connector_sync_started",
    ...logContext,
    maxAttempts: policy.maxAttempts
  });

  try {
    const syncResult = await runWithRetry(
      () =>
        input.connector.sync({
          connection: input.connection,
          now: input.now,
          credentialStore: input.credentialStore
        }),
      policy,
      retryObserver
    );

    const coverage = computeCoverage(syncResult.segments);
    const freshness = computeFreshness({
      latestDataAt: syncResult.latestDataAt,
      now: input.now,
      freshnessSlaMinutes: input.connection.freshnessSlaMinutes
    });

    const issues: ConnectorSyncRunIssueRecord[] = syncResult.segments
      .filter((segment) => segment.status === "failed")
      .map((segment) => ({
        segment: segment.segment,
        code: segment.code ?? "UNKNOWN",
        message: segment.message ?? "Segment sync failed",
        retryable: segment.retryable ?? false
      }));

    const status = deriveStatus({
      succeededSegments: coverage.succeededSegments,
      expectedSegments: coverage.expectedSegments
    });
    const partialFailure = status === "partial_failed";
    const partialFailureCount = issues.length;
    const finishedAt = new Date();
    const durationMs = computeDurationMs(
      executionStartedAtMs,
      finishedAt.getTime()
    );
    const stale = deriveStale({
      latestDataAt: syncResult.latestDataAt,
      freshness
    });
    const health = deriveHealthSummary({
      status,
      partialFailure,
      partialFailureCount,
      attemptCount: retryTelemetry.attemptCount,
      retryCount: retryTelemetry.retryCount,
      rateLimitCount: retryTelemetry.rateLimitCount,
      durationMs,
      stale,
      freshness,
      coverage,
      issues
    });

    const runRecord: ConnectorSyncRunRecord = {
      id: runId,
      integrationConnectionId: input.connection.id,
      status,
      partialFailure,
      partialFailureCount,
      trigger: input.trigger,
      startedAt,
      finishedAt,
      durationMs,
      stale,
      freshnessMetadataJson: freshness,
      coverageMetadataJson: coverage,
      health,
      healthMetadataJson: health,
      issues,
      ...(syncResult.connectionUpdates
        ? { connectionUpdates: syncResult.connectionUpdates }
        : {})
    };

    await input.persistence.writeRun(runRecord);

    safeInfo(logger, {
      event: "connector_sync_completed",
      ...logContext,
      status,
      partialFailure,
      partialFailureCount,
      issueCount: issues.length,
      attemptCount: retryTelemetry.attemptCount,
      retryCount: retryTelemetry.retryCount,
      rateLimitCount: retryTelemetry.rateLimitCount,
      durationMs,
      stale
    });

    return {
      status,
      partialFailure,
      partialFailureCount,
      durationMs,
      stale,
      freshness,
      coverage,
      health,
      issues
    };
  } catch (error) {
    safeError(logger, {
      event: "connector_sync_failed",
      ...logContext,
      attemptCount: retryTelemetry.attemptCount,
      retryCount: retryTelemetry.retryCount,
      rateLimitCount: retryTelemetry.rateLimitCount,
      durationMs: computeDurationMs(executionStartedAtMs, Date.now()),
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      ...(typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? { code: error.code }
        : {})
    });
    throw error;
  }
}
