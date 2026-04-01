import { createHash } from "node:crypto";

import { prisma } from "@webops-wizard/db";
import type {
  WorkflowPayloadByQueue,
  WorkflowQueueName
} from "@webops-wizard/types";

import { ConnectorSyncService } from "../domains/integrations/sync/connector-sync.service";

export interface WorkerProcessorContext {
  queueName: WorkflowQueueName;
}

export type WorkerProcessor<TQueue extends WorkflowQueueName> = (
  payload: WorkflowPayloadByQueue[TQueue],
  context: WorkerProcessorContext
) => Promise<Record<string, unknown>>;

export type WorkerProcessorMap = {
  [TQueue in WorkflowQueueName]: WorkerProcessor<TQueue>;
};

function toStableRunId(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
}

const connectorSyncService = new ConnectorSyncService();

export const workerProcessors: WorkerProcessorMap = {
  "connector-sync": async (payload) => {
    const run = await connectorSyncService.runForConnection({
      integrationConnectionId: payload.integrationConnectionId,
      trigger: payload.trigger,
      idempotencyRunId: toStableRunId(payload.idempotencyKey)
    });

    return {
      status: run.status,
      partialFailure: run.partialFailure,
      freshness: run.freshness,
      coverage: run.coverage,
      issues: run.issues.length
    };
  },
  "crawl-ingestion": async (payload) => {
    const urlRecordCount = payload.propertyId
      ? await prisma.urlRecord.count({ where: { propertyId: payload.propertyId } })
      : 0;

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      ingestedUrlRecords: urlRecordCount
    };
  },
  "page-identity-resolution": async (payload) => {
    const [urlRecordCount, canonicalPageCount] = payload.propertyId
      ? await Promise.all([
          prisma.urlRecord.count({ where: { propertyId: payload.propertyId } }),
          prisma.canonicalPage.count({ where: { propertyId: payload.propertyId } })
        ])
      : [0, 0];

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      urlRecordsScanned: urlRecordCount,
      canonicalPages: canonicalPageCount
    };
  },
  "metric-aggregation": async (payload) => {
    const [pageMetricRows, queryMetricRows] = payload.propertyId
      ? await Promise.all([
          prisma.pageMetricDaily.count({ where: { propertyId: payload.propertyId } }),
          prisma.queryMetricDaily.count({ where: { propertyId: payload.propertyId } })
        ])
      : [0, 0];

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      pageMetricRows,
      queryMetricRows
    };
  },
  "trust-scoring": async (payload) => {
    const latestHealth = payload.propertyId
      ? await prisma.dataSourceHealth.findMany({
          where: { propertyId: payload.propertyId },
          orderBy: [{ measuredAt: "desc" }],
          take: 20
        })
      : [];

    const averageReliability =
      latestHealth.length === 0
        ? null
        : latestHealth.reduce(
            (sum, row) => sum + Number(row.reliabilityScore ?? 0),
            0
          ) / latestHealth.length;

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      rowsEvaluated: latestHealth.length,
      averageReliability
    };
  },
  "recommendation-generation": async (payload) => {
    const existingRecommendations = payload.propertyId
      ? await prisma.recommendation.count({ where: { propertyId: payload.propertyId } })
      : 0;

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      existingRecommendations
    };
  },
  "report-generation": async (payload) => {
    const reportCount = payload.propertyId
      ? await prisma.report.count({ where: { propertyId: payload.propertyId } })
      : 0;

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      reportsInScope: reportCount
    };
  },
  "alert-evaluation": async (payload) => {
    const openAlertCount = payload.propertyId
      ? await prisma.alert.count({
          where: {
            propertyId: payload.propertyId,
            status: "open"
          }
        })
      : 0;

    return {
      status: "processed",
      propertyId: payload.propertyId ?? null,
      openAlertCount
    };
  },
  "cache-refresh": (payload) =>
    Promise.resolve({
      status: "processed",
      workspaceId: payload.workspaceId,
      propertyId: payload.propertyId ?? null,
      refreshedAt: new Date().toISOString()
    })
};
