import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("data-trust")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class DataTrustController {
  @Get()
  @RequireWorkspaceCapabilities("data_trust.read")
  async getDataTrust(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const [propertyCount, integrationCount] = await Promise.all([
      prisma.property.count({
        where: { workspaceId: workspace.workspaceId }
      }),
      prisma.integrationConnection.count({
        where: { workspaceId: workspace.workspaceId }
      })
    ]);

    return {
      workspaceId: workspace.workspaceId,
      status: "healthy",
      signals: {
        propertyCount,
        integrationCount
      }
    };
  }
}

