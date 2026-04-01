import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { prisma } from "@webops-wizard/db";
import type { FastifyRequest } from "fastify";

import { AuditService } from "../../common/audit/audit.service";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";

@Controller("recommendations")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class RecommendationsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("recommendations.read")
  async listRecommendations(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const items = await prisma.recommendation.findMany({
      where: {
        property: {
          workspaceId: workspace.workspaceId
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return {
      workspaceId: workspace.workspaceId,
      items
    };
  }

  @Post("generate")
  @RequireWorkspaceCapabilities("ai.generate")
  async generateRecommendation(
    @Body() body: { title?: string; category?: string },
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const property = await prisma.property.findFirst({
      where: { workspaceId: workspace.workspaceId },
      orderBy: [{ createdAt: "asc" }]
    });
    if (!property) {
      throw new NotFoundException("Create a property before generating recommendations.");
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        propertyId: property.id,
        title: body.title?.trim() || "AI generated recommendation",
        category: body.category?.trim() || "technical",
        status: "new"
      }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "ai_generation",
        eventType: "ai.recommendation_generated",
        targetType: "recommendation",
        targetId: recommendation.id,
        metadataJson: {
          propertyId: property.id
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      recommendation
    };
  }

  @Patch(":recommendationId/approve")
  @RequireWorkspaceCapabilities("approval.manage")
  async approveRecommendation(
    @Param("recommendationId") recommendationId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: recommendationId,
        property: {
          workspaceId: workspace.workspaceId
        }
      }
    });
    if (!recommendation) {
      throw new NotFoundException("Recommendation not found in workspace.");
    }

    const approved = await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: { status: "approved" }
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "approval",
        eventType: "approval.recommendation_approved",
        targetType: "recommendation",
        targetId: recommendation.id,
        metadataJson: {
          previousStatus: recommendation.status,
          nextStatus: approved.status
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      recommendation: approved
    };
  }
}
