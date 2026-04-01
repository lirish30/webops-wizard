import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
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

@Controller("settings")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class SettingsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("settings.read")
  async getSettings(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const workspaceSettings = await prisma.workspace.findUnique({
      where: { id: workspace.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        planTier: true,
        status: true,
        updatedAt: true
      }
    });

    return {
      workspaceId: workspace.workspaceId,
      settings: workspaceSettings
    };
  }

  @Patch("workspace")
  @RequireWorkspaceCapabilities("settings.manage")
  async updateWorkspaceSettings(
    @Body() body: { planTier?: string; region?: string; status?: "active" | "suspended" },
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const data: Parameters<typeof prisma.workspace.update>[0]["data"] = {
      ...(body.planTier !== undefined ? { planTier: body.planTier } : {}),
      ...(body.region !== undefined ? { region: body.region } : {}),
      ...(body.status !== undefined ? { status: body.status } : {})
    };

    const updated = await prisma.workspace.update({
      where: { id: workspace.workspaceId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        planTier: true,
        status: true,
        updatedAt: true
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "settings",
        eventType: "settings.workspace_updated",
        targetType: "workspace_settings",
        targetId: workspace.workspaceId,
        metadataJson: {
          region: updated.region,
          planTier: updated.planTier,
          status: updated.status
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      settings: updated
    };
  }
}
