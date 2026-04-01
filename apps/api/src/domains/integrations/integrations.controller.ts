import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { z } from "zod";

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
import { BackgroundJobsService } from "../background-jobs/background-jobs.service";
import {
  completeGscOAuthSchema,
  completeGa4OAuthSchema,
  requestGscBackfillSchema,
  requestGa4BackfillSchema,
  selectGscSiteSchema,
  selectGa4PropertySchema,
  startGscOAuthSchema,
  startGa4OAuthSchema,
  updateIntegrationSchema
} from "./integrations.dto";
import { IntegrationsService } from "./integrations.service";

const syncNowSchema = z.object({
  propertyId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(256).optional()
});

@Controller("integrations")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("integrations")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly auditService: AuditService,
    private readonly backgroundJobsService: BackgroundJobsService
  ) {}

  @Get()
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "List integrations in the current workspace" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        items: { type: "array", items: { type: "object", additionalProperties: true } }
      }
    })
  })
  async listIntegrations(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const integrations = await this.integrationsService.listIntegrations(workspace.workspaceId);

    return {
      workspaceId: workspace.workspaceId,
      items: integrations
    };
  }

  @Get(":integrationId/ga4/status")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "Get GA4 connector status, auth, and freshness details" })
  async getGa4Status(
    @Param("integrationId") integrationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const status = await this.integrationsService.getGa4Status(
      workspace.workspaceId,
      integrationId
    );

    return {
      workspaceId: workspace.workspaceId,
      ga4: status
    };
  }

  @Post(":integrationId/ga4/oauth/start")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Start GA4 OAuth placeholder flow" })
  async startGa4OAuth(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(startGa4OAuthSchema, body);
    const started = await this.integrationsService.startGa4OAuth({
      workspaceId: workspace.workspaceId,
      integrationId,
      redirectUri: input.redirectUri
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.oauth_started",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "ga4",
          state: started.state
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...started
    };
  }

  @Post(":integrationId/ga4/oauth/complete")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Complete GA4 OAuth placeholder flow" })
  async completeGa4OAuth(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(completeGa4OAuthSchema, body);
    const completed = await this.integrationsService.completeGa4OAuth({
      workspaceId: workspace.workspaceId,
      integrationId,
      code: input.code,
      state: input.state,
      redirectUri: input.redirectUri
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.oauth_completed",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "ga4",
          credentialRef: completed.credentialRef
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...completed
    };
  }

  @Get(":integrationId/ga4/properties")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "List cached GA4 properties for an integration" })
  async listGa4Properties(
    @Param("integrationId") integrationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const properties = await this.integrationsService.listGa4Properties(
      workspace.workspaceId,
      integrationId
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      items: properties
    };
  }

  @Post(":integrationId/ga4/select-property")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Store the selected GA4 property and sync settings" })
  async selectGa4Property(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(selectGa4PropertySchema, body);
    const integration = await this.integrationsService.selectGa4Property({
      workspaceId: workspace.workspaceId,
      integrationId,
      propertyId: input.propertyId,
      displayName: input.displayName,
      ...(input.syncEveryMinutes ? { syncEveryMinutes: input.syncEveryMinutes } : {}),
      ...(input.freshnessSlaMinutes
        ? { freshnessSlaMinutes: input.freshnessSlaMinutes }
        : {}),
      ...(input.lookbackDays ? { lookbackDays: input.lookbackDays } : {})
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.property_selected",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "ga4",
          propertyId: input.propertyId
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integration
    };
  }

  @Post(":integrationId/ga4/backfill")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Request a GA4 backfill and enqueue sync" })
  async requestGa4Backfill(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(requestGa4BackfillSchema, body);
    await this.integrationsService.requestGa4Backfill({
      workspaceId: workspace.workspaceId,
      integrationId,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedByUserId: workspace.userId
    });

    const enqueued = await this.backgroundJobsService.enqueueForWorkspace({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      body: {
        workflow: "connector-sync",
        integrationConnectionId: integrationId,
        trigger: "manual"
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.backfill_requested",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "ga4",
          startDate: input.startDate,
          endDate: input.endDate,
          workflowJobId: enqueued.job.id
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...enqueued
    };
  }

  @Get(":integrationId/gsc/status")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "Get GSC connector status, auth, and freshness details" })
  async getGscStatus(
    @Param("integrationId") integrationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const status = await this.integrationsService.getGscStatus(
      workspace.workspaceId,
      integrationId
    );

    return {
      workspaceId: workspace.workspaceId,
      gsc: status
    };
  }

  @Post(":integrationId/gsc/oauth/start")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Start GSC OAuth placeholder flow" })
  async startGscOAuth(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(startGscOAuthSchema, body);
    const started = await this.integrationsService.startGscOAuth({
      workspaceId: workspace.workspaceId,
      integrationId,
      redirectUri: input.redirectUri
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.oauth_started",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "gsc",
          state: started.state
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...started
    };
  }

  @Post(":integrationId/gsc/oauth/complete")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Complete GSC OAuth placeholder flow" })
  async completeGscOAuth(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(completeGscOAuthSchema, body);
    const completed = await this.integrationsService.completeGscOAuth({
      workspaceId: workspace.workspaceId,
      integrationId,
      code: input.code,
      state: input.state,
      redirectUri: input.redirectUri
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.oauth_completed",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "gsc",
          credentialRef: completed.credentialRef
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...completed
    };
  }

  @Get(":integrationId/gsc/sites")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "List cached GSC sites for an integration" })
  async listGscSites(
    @Param("integrationId") integrationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const sites = await this.integrationsService.listGscSites(
      workspace.workspaceId,
      integrationId
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      items: sites
    };
  }

  @Post(":integrationId/gsc/select-site")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Store the selected GSC site and sync settings" })
  async selectGscSite(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(selectGscSiteSchema, body);
    const integration = await this.integrationsService.selectGscSite({
      workspaceId: workspace.workspaceId,
      integrationId,
      siteUrl: input.siteUrl,
      displayName: input.displayName,
      ...(input.syncEveryMinutes ? { syncEveryMinutes: input.syncEveryMinutes } : {}),
      ...(input.freshnessSlaMinutes
        ? { freshnessSlaMinutes: input.freshnessSlaMinutes }
        : {}),
      ...(input.lookbackDays ? { lookbackDays: input.lookbackDays } : {})
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.property_selected",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "gsc",
          siteUrl: input.siteUrl
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integration
    };
  }

  @Post(":integrationId/gsc/backfill")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Request a GSC backfill and enqueue sync" })
  async requestGscBackfill(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(requestGscBackfillSchema, body);
    await this.integrationsService.requestGscBackfill({
      workspaceId: workspace.workspaceId,
      integrationId,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedByUserId: workspace.userId
    });

    const enqueued = await this.backgroundJobsService.enqueueForWorkspace({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      body: {
        workflow: "connector-sync",
        integrationConnectionId: integrationId,
        trigger: "manual"
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.backfill_requested",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          provider: "gsc",
          startDate: input.startDate,
          endDate: input.endDate,
          workflowJobId: enqueued.job.id
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...enqueued
    };
  }

  @Patch(":integrationId")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Update integration status/configuration" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["connected", "warning", "error", "syncing"],
          example: "connected"
        },
        configJson: {
          type: "object",
          additionalProperties: true,
          example: { syncWindowDays: 30 }
        }
      }
    }
  })
  async updateIntegration(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(updateIntegrationSchema, body);
    const updated = await this.integrationsService.updateIntegration({
      integrationId,
      workspaceId: workspace.workspaceId,
      body: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.configJson !== undefined ? { configJson: input.configJson } : {})
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.updated",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          status: updated?.status ?? null
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integration: updated
    };
  }

  @Post(":integrationId/sync-now")
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Enqueue connector sync job for integration" })
  async syncNow(
    @Param("integrationId") integrationId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(syncNowSchema, body);
    const enqueued = await this.backgroundJobsService.enqueueForWorkspace({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      body: {
        workflow: "connector-sync",
        integrationConnectionId: integrationId,
        propertyId: input.propertyId,
        trigger: "manual",
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {})
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "integration",
        eventType: "integration.sync_requested",
        targetType: "integration_connection",
        targetId: integrationId,
        metadataJson: {
          deduplicated: enqueued.deduplicated,
          workflowJobId: enqueued.job.id
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      integrationId,
      ...enqueued
    };
  }
}
