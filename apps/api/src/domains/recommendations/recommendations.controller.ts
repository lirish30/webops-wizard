import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
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
import {
  generateRecommendationSchema,
  listRecommendationsQuerySchema
} from "./recommendations.dto";
import { RecommendationsService } from "./recommendations.service";

@Controller("recommendations")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("recommendations")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @RequireWorkspaceCapabilities("recommendations.read")
  @ApiOperation({ summary: "List recommendations with pagination/filter/sort" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 25 })
  @ApiQuery({ name: "sort", required: false, example: "createdAt:desc" })
  @ApiQuery({ name: "status", required: false, example: "new" })
  @ApiQuery({ name: "domain", required: false, example: "technical" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        items: { type: "array", items: { type: "object", additionalProperties: true } },
        pagination: { type: "object", additionalProperties: true }
      }
    })
  })
  async listRecommendations(
    @Query() query: Record<string, unknown>,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    parseWithSchema(listRecommendationsQuerySchema, query, "query");
    return this.recommendationsService.listRecommendations(workspace.workspaceId, query);
  }

  @Post("generate")
  @RequireWorkspaceCapabilities("ai.generate")
  @ApiOperation({ summary: "Generate a recommendation for workspace" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string", example: "Reduce LCP on category pages" },
        category: { type: "string", example: "technical" }
      }
    }
  })
  async generateRecommendation(
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(generateRecommendationSchema, body);
    const result = await this.recommendationsService.generateRecommendation({
      workspaceId: workspace.workspaceId,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {})
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "ai_generation",
        eventType: "ai.recommendation_generated",
        targetType: "recommendation",
        targetId: result.recommendation.id,
        metadataJson: {
          propertyId: result.propertyId
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      recommendation: result.recommendation
    };
  }

  @Patch(":recommendationId/approve")
  @RequireWorkspaceCapabilities("approval.manage")
  @ApiOperation({ summary: "Approve a recommendation" })
  async approveRecommendation(
    @Param("recommendationId") recommendationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const result = await this.recommendationsService.approveRecommendation({
      workspaceId: workspace.workspaceId,
      recommendationId
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "approval",
        eventType: "approval.recommendation_approved",
        targetType: "recommendation",
        targetId: recommendationId,
        metadataJson: {
          previousStatus: result.previousStatus,
          nextStatus: result.approved.status
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      recommendation: result.approved
    };
  }
}
