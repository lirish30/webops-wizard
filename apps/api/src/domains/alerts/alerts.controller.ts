import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("alerts")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class AlertsController {
  @Get()
  @RequireWorkspaceCapabilities("alerts.read")
  async listAlerts(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const items = await prisma.alert.findMany({
      where: {
        property: {
          workspaceId: workspace.workspaceId
        }
      },
      orderBy: [{ triggeredAt: "desc" }]
    });

    return {
      workspaceId: workspace.workspaceId,
      items
    };
  }
}

