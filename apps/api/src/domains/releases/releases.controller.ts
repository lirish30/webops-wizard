import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { COOKIE_AUTH_SCHEME } from "../../common/api/openapi-schemas";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import { ReleasesService } from "./releases.service";

@Controller("releases")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("releases")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @Get()
  @RequireWorkspaceCapabilities("releases.read")
  @ApiOperation({ summary: "List release annotations for workspace" })
  async listReleases(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const items = await this.releasesService.listReleases(workspace.workspaceId);

    return {
      workspaceId: workspace.workspaceId,
      items
    };
  }
}
