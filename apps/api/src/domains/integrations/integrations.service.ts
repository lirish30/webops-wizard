import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class IntegrationsService {
  async listIntegrations(workspaceId: string) {
    return prisma.integrationConnection.findMany({
      where: { workspaceId },
      orderBy: [{ updatedAt: "desc" }]
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
