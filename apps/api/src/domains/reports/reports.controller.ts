import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
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

@Controller("reports")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class ReportsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("reports.read")
  async listReports(@CurrentWorkspace() workspace: WorkspaceAccess) {
    const [recommendationCount, alertCount, releaseCount] = await Promise.all([
      prisma.recommendation.count({
        where: { property: { workspaceId: workspace.workspaceId } }
      }),
      prisma.alert.count({
        where: { property: { workspaceId: workspace.workspaceId } }
      }),
      prisma.releaseAnnotation.count({
        where: { property: { workspaceId: workspace.workspaceId } }
      })
    ]);

    return {
      workspaceId: workspace.workspaceId,
      generatedAt: new Date().toISOString(),
      summary: {
        recommendationCount,
        alertCount,
        releaseCount
      }
    };
  }

  @Post("send")
  @RequireWorkspaceCapabilities("reports.send")
  async sendReport(
    @Body() body: { reportName: string; recipients: string[] },
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const reportName = body.reportName?.trim() || "Untitled report";
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: workspace.userId,
        category: "report",
        eventType: "report.sent",
        targetType: "workspace_report",
        targetId: workspace.workspaceId,
        metadataJson: {
          reportName,
          recipientCount: recipients.length
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      sent: true,
      reportName,
      recipientCount: recipients.length
    };
  }
}
