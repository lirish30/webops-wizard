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
import { PropertiesService } from "./properties.service";

@Controller("properties")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("properties")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @RequireWorkspaceCapabilities("property.read")
  @ApiOperation({ summary: "List properties in workspace" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        items: { type: "array", items: { type: "object", additionalProperties: true } }
      }
    })
  })
  async listProperties(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const properties = await this.propertiesService.listProperties(workspace.workspaceId);

    return {
      workspaceId: workspace.workspaceId,
      items: properties
    };
  }
}
