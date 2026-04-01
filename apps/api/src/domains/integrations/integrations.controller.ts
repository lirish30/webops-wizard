import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards
} from "@nestjs/common";
import { prisma } from "@webops-wizard/db";
import type { FastifyRequest } from "fastify";

import { AuditService } from "../../common/audit/audit.service";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("integrations")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class IntegrationsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("integration.read")
  async listIntegrations(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const integrations = await prisma.integrationConnection.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: [{ updatedAt: "desc" }]
    });

    return {
      workspaceId: workspace.workspaceId,
      items: integrations
    };
  }

  @Patch(":integrationId")
  @RequireWorkspaceCapabilities("integration.manage")
  async updateIntegration(
    @Param("integrationId") integrationId: string,
    @Body() body: { status?: "connected" | "warning" | "error" | "syncing"; configJson?: unknown },
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const data: Parameters<typeof prisma.integrationConnection.updateMany>[0]["data"] = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.configJson !== undefined
        ? { configJson: body.configJson as never }
        : {})
    };

    const updateResult = await prisma.integrationConnection.updateMany({
      where: {
        id: integrationId,
        workspaceId: workspace.workspaceId
      },
      data
    });

    if (updateResult.count === 0) {
      throw new NotFoundException("Integration not found in workspace.");
    }

    const updated = await prisma.integrationConnection.findUnique({
      where: { id: integrationId }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.updated",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          status: updated?.status ?? null
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integration: updated
    };
  }
}
