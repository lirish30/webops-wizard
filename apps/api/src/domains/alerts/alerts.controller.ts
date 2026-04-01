import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";

import {
  buildSuccessEnvelopeSchema,
  COOKIE_AUTH_SCHEME
} from "../../common/api/openapi-schemas";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("alerts")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @RequireWorkspaceCapabilities("alerts.read")
  @ApiOperation({ summary: "List alerts in the current workspace" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        items: { type: "array", items: { type: "object", additionalProperties: true } }
      }
    })
  })
  async listAlerts(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const items = await this.alertsService.listAlerts(workspace.workspaceId);

    return {
      workspaceId: workspace.workspaceId,
      items
    };
  }
}
