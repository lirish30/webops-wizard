import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("properties")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class PropertiesController {
  @Get()
  @RequireWorkspaceCapabilities("property.read")
  async listProperties(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const properties = await prisma.property.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: [{ createdAt: "desc" }]
    });

    return {
      workspaceId: workspace.workspaceId,
      items: properties
    };
  }
}

