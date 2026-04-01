import { Prisma } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

import type { ConnectorConnectionContext } from "../connectors/connector.types";
import type {
  ConnectorSyncRunRecord,
  SyncPersistence
} from "./sync-runner";

function toInputJson(value: object): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaSyncPersistence implements SyncPersistence {
  constructor(private readonly connection: ConnectorConnectionContext) {}

  async writeRun(run: ConnectorSyncRunRecord): Promise<void> {
    try {
      await prisma.connectorSyncRun.create({
        data: {
          id: run.id,
          integrationConnectionId: run.integrationConnectionId,
          workspaceId: this.connection.workspaceId,
          propertyId: this.connection.propertyId,
          provider: this.connection.provider,
          trigger: run.trigger,
          status: run.status,
          partialFailure: run.partialFailure,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          freshnessMetadataJson: toInputJson(run.freshnessMetadataJson),
          coverageMetadataJson: toInputJson(run.coverageMetadataJson),
          healthMetadataJson: toInputJson(run.healthMetadataJson),
          issues: {
            create: run.issues.map((issue) => ({
              segment: issue.segment,
              code: issue.code,
              message: issue.message,
              retryable: issue.retryable,
              metadataJson: Prisma.JsonNull
            }))
          }
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }

      throw error;
    }

    const isFailed = run.status === "failed";

    await prisma.integrationConnection.update({
      where: { id: run.integrationConnectionId },
      data: {
        lastSyncedAt: run.finishedAt,
        ...(!isFailed ? { lastSuccessAt: run.finishedAt } : {}),
        lastErrorAt: isFailed ? run.finishedAt : null,
        lastErrorMessage:
          isFailed ? run.issues[0]?.message ?? "Sync failed" : null,
        status:
          run.status === "success"
            ? "connected"
            : run.status === "partial_failed"
              ? "warning"
              : "error",
        ...(run.connectionUpdates?.configJson !== undefined
          ? {
              configJson: run.connectionUpdates.configJson as Prisma.InputJsonValue
            }
          : {})
      }
    });

    if (this.connection.propertyId) {
      await prisma.dataSourceHealth.create({
        data: {
          propertyId: this.connection.propertyId,
          integrationConnectionId: run.integrationConnectionId,
          sourceName: this.connection.provider,
          healthStatus:
            run.healthMetadataJson.status === "success"
              ? "healthy"
              : run.healthMetadataJson.status === "partial_failed"
                ? "partial"
                : "error",
          freshnessScore: run.healthMetadataJson.withinSla ? 1 : 0,
          coverageScore: run.healthMetadataJson.coverageRatio,
          reliabilityScore: run.healthMetadataJson.status === "failed" ? 0 : 1,
          issueCount: run.healthMetadataJson.issueCount,
          measuredAt: run.finishedAt
        }
      });
    }
  }
}
