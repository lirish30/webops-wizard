import { describe, expect, it } from "vitest";

import {
  buildLastSyncHealth,
  type LatestSyncRunLike
} from "./integrations.health";

describe("buildLastSyncHealth", () => {
  it("returns null when no run exists", () => {
    const health = buildLastSyncHealth({
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      latestRun: null
    });

    expect(health).toBeNull();
  });

  it("maps latest run metadata into API-safe shape", () => {
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
      }
    };

    const health = buildLastSyncHealth({
      lastSuccessAt: new Date("2026-04-01T00:58:00.000Z"),
      lastErrorAt: new Date("2026-04-01T00:59:00.000Z"),
      lastErrorMessage: "Conversions stream timed out",
      latestRun: run
    });

    expect(health).toMatchObject({
      status: "partial_failed",
      partialFailure: true,
      lastError: {
        at: "2026-04-01T00:59:00.000Z",
        message: "Conversions stream timed out"
      },
      freshness: {
        lagMinutes: 15,
        withinSla: true
      }
    });
  });
});
