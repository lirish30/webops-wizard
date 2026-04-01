import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("releases")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class ReleasesController {
  @Get()
  @RequireWorkspaceCapabilities("releases.read")
  async listReleases(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const items = await prisma.releaseAnnotation.findMany({
      where: {
        property: {
          workspaceId: workspace.workspaceId
        }
      },
      orderBy: [{ startedAt: "desc" }]
    });

    return {
      workspaceId: workspace.workspaceId,
      items
    };
  }
}

