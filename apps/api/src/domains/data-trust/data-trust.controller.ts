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
import { DataTrustService } from "./data-trust.service";

@Controller("data-trust")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("data-trust")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class DataTrustController {
  constructor(private readonly dataTrustService: DataTrustService) {}

  @Get()
  @RequireWorkspaceCapabilities("data_trust.read")
  @ApiOperation({ summary: "Get data trust health summary" })
  async getDataTrust(@CurrentWorkspace() workspace: WorkspaceAccess) {
    return this.dataTrustService.getSummary(workspace.workspaceId);
  }
}
