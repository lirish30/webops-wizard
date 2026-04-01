export interface LatestSyncRunLike {
  startedAt: Date;
  status: "running" | "success" | "partial_failed" | "failed" | "retriable_failed";
  partialFailure: boolean;
  freshnessMetadataJson: unknown;
  coverageMetadataJson: unknown;
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
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function buildLastSyncHealth(input: {
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  latestRun: LatestSyncRunLike | null;
}): LastSyncHealth | null {
  if (!input.latestRun) {
    return null;
  }

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
    coverage: asRecord(input.latestRun.coverageMetadataJson)
  };
}
