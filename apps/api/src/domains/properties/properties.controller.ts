import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { AuditService } from "../../common/audit/audit.service";
import {
  buildSuccessEnvelopeSchema,
  COOKIE_AUTH_SCHEME
} from "../../common/api/openapi-schemas";
import { parseWithSchema } from "../../common/api/validation";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import { savePropertySetupDraftSchema } from "./properties.dto";
import { PropertiesService } from "./properties.service";

@Controller("properties")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("properties")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly auditService: AuditService
  ) {}

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

  @Get("setup/draft/:propertyId")
  @RequireWorkspaceCapabilities("property.read")
  @ApiOperation({ summary: "Get setup wizard draft for a property" })
  async getSetupDraft(
    @Param("propertyId") propertyId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    return this.propertiesService.getSetupDraft({
      workspaceId: workspace.workspaceId,
      propertyId
    });
  }

  @Post("setup/draft")
  @RequireWorkspaceCapabilities("property.write")
  @ApiOperation({ summary: "Save setup wizard draft step and resume later state" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["step", "payload"],
      properties: {
        propertyId: { type: "string", format: "uuid" },
        step: {
          type: "string",
          enum: [
            "workspaceDetails",
            "propertyBasics",
            "domainAndSitemap",
            "ga4Connection",
            "gscConnection",
            "conversionDefinitions",
            "priorityPagesAndPageGroups",
            "reportingRecipientsAndAlertSettings",
            "reviewAndActivate"
          ]
        },
        currentStep: {
          type: "string",
          enum: [
            "workspaceDetails",
            "propertyBasics",
            "domainAndSitemap",
            "ga4Connection",
            "gscConnection",
            "conversionDefinitions",
            "priorityPagesAndPageGroups",
            "reportingRecipientsAndAlertSettings",
            "reviewAndActivate"
          ]
        },
        payload: { type: "object", additionalProperties: true }
      }
    }
  })
  async saveSetupDraft(
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const payload = parseWithSchema(savePropertySetupDraftSchema, body);
    const result = await this.propertiesService.saveSetupDraft({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      payload
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "settings",
        eventType: "property.setup_draft_saved",
        targetType: "property",
        targetId: result.propertyId,
        metadataJson: {
          step: payload.step,
          currentStep: result.draft.currentStep
        }
      },
      request
    );

    return result;
  }

  @Post("setup/activate/:propertyId")
  @RequireWorkspaceCapabilities("property.write")
  @ApiOperation({ summary: "Review and activate property setup wizard" })
  async activateSetup(
    @Param("propertyId") propertyId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const result = await this.propertiesService.activateSetup({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      propertyId
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "settings",
        eventType: "property.setup_activated",
        targetType: "property",
        targetId: propertyId,
        metadataJson: {
          setupVersion: result.setupVersion
        }
      },
      request
    );

    return result;
  }

  @Get(":propertyId/setup/versions")
  @RequireWorkspaceCapabilities("property.read")
  @ApiOperation({ summary: "List versioned property setup configurations" })
  async listConfigurationVersions(
    @Param("propertyId") propertyId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    return this.propertiesService.listConfigurationVersions({
      workspaceId: workspace.workspaceId,
      propertyId
    });
  }
}
