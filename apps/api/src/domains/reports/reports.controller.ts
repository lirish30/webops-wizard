import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
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
import { sendReportSchema } from "./reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("reports")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @RequireWorkspaceCapabilities("reports.read")
  @ApiOperation({ summary: "Get report summary for workspace" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        generatedAt: { type: "string", format: "date-time" },
        summary: { type: "object", additionalProperties: true }
      }
    })
  })
  async listReports(@CurrentWorkspace() workspace: WorkspaceAccess) {
    return this.reportsService.getReportSummary(workspace.workspaceId);
  }

  @Post("send")
  @RequireWorkspaceCapabilities("reports.send")
  @ApiOperation({ summary: "Send a workspace report to recipients" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        reportName: { type: "string", example: "Weekly SEO Summary" },
        recipients: {
          type: "array",
          items: { type: "string", format: "email" },
          example: ["ops@acme.com", "ceo@acme.com"]
        }
      },
      required: ["reportName", "recipients"]
    }
  })
  async sendReport(
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(sendReportSchema, body);
    const reportName = input.reportName.trim();
    const recipients = input.recipients;

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
