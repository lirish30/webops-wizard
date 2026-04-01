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
import { updateIntegrationSchema } from "./integrations.dto";
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
