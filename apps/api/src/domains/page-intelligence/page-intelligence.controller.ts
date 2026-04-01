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
import { PagesService } from "./pages.service";

@Controller("pages")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("pages")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class PageIntelligenceController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @RequireWorkspaceCapabilities("page_intelligence.read")
  @ApiOperation({ summary: "Get pages intelligence readiness signals" })
  async getPageIntelligence(@CurrentWorkspace() workspace: WorkspaceAccess) {
    return this.pagesService.getOverview(workspace.workspaceId);
  }
}
