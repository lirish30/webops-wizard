import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("page-intelligence")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class PageIntelligenceController {
  @Get()
  @RequireWorkspaceCapabilities("page_intelligence.read")
  async getPageIntelligence(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const propertyCount = await prisma.property.count({
      where: { workspaceId: workspace.workspaceId }
    });

    return {
      workspaceId: workspace.workspaceId,
      status: "ready",
      propertyCount
    };
  }
}

