import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import { buildLastSyncHealth } from "./integrations.health";

@Injectable()
export class IntegrationsService {
  async listIntegrations(workspaceId: string) {
    const rows = await prisma.integrationConnection.findMany({
      where: { workspaceId },
      include: {
        syncRuns: {
          take: 1,
          orderBy: [{ startedAt: "desc" }]
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => {
      const { syncRuns, ...connection } = row;

      return {
        ...connection,
        lastSyncHealth: buildLastSyncHealth({
          lastSuccessAt: row.lastSuccessAt,
          lastErrorAt: row.lastErrorAt,
          lastErrorMessage: row.lastErrorMessage,
          latestRun: syncRuns[0]
            ? {
                startedAt: syncRuns[0].startedAt,
                status: syncRuns[0].status,
                partialFailure: syncRuns[0].partialFailure,
                freshnessMetadataJson: syncRuns[0].freshnessMetadataJson,
                coverageMetadataJson: syncRuns[0].coverageMetadataJson
              }
            : null
        })
      };
    });
  }

  async updateIntegration(input: {
    integrationId: string;
    workspaceId: string;
    body: { status?: "connected" | "warning" | "error" | "syncing"; configJson?: unknown };
  }) {
    const data: Parameters<typeof prisma.integrationConnection.updateMany>[0]["data"] = {
      ...(input.body.status ? { status: input.body.status } : {}),
      ...(input.body.configJson !== undefined
        ? { configJson: input.body.configJson as never }
        : {})
    };

    const updateResult = await prisma.integrationConnection.updateMany({
      where: {
        id: input.integrationId,
        workspaceId: input.workspaceId
      },
      data
    });

    if (updateResult.count === 0) {
      throw new NotFoundException("Integration not found in workspace.");
    }

    return prisma.integrationConnection.findUnique({
      where: { id: input.integrationId }
    });
  }
}
