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

export interface ConnectorSyncRunRecord {
  id: string;
  integrationConnectionId: string;
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date;
  freshnessMetadataJson: FreshnessMetadata;
  coverageMetadataJson: CoverageMetadata;
  issues: ConnectorSyncRunIssueRecord[];
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
}

export interface RunConnectorSyncResult {
  status: ConnectorSyncRunStatus;
  partialFailure: boolean;
  freshness: FreshnessMetadata;
  coverage: CoverageMetadata;
  issues: ConnectorSyncRunIssueRecord[];
}

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

export async function runConnectorSync(
  input: RunConnectorSyncInput
): Promise<RunConnectorSyncResult> {
  const startedAt = input.now;

  const policy = input.retryPolicy ?? createRetryPolicy();
  const syncResult = await runWithRetry(
    () =>
      input.connector.sync({
        connection: input.connection,
        now: input.now,
        credentialStore: input.credentialStore
      }),
    policy
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

  const runRecord: ConnectorSyncRunRecord = {
    id: input.runId ?? randomUUID(),
    integrationConnectionId: input.connection.id,
    status,
    partialFailure: status === "partial_failed",
    trigger: input.trigger,
    startedAt,
    finishedAt: new Date(),
    freshnessMetadataJson: freshness,
    coverageMetadataJson: coverage,
    issues
  };

  await input.persistence.writeRun(runRecord);

  return {
    status,
    partialFailure: runRecord.partialFailure,
    freshness,
    coverage,
    issues
  };
}
