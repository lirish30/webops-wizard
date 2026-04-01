import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";

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
import { queryAuditLogSchema } from "./audit-log.schemas";

@Controller("audit-logs")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("audit-log")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("audit.read")
  @ApiOperation({ summary: "Query workspace audit log events" })
  @ApiQuery({ name: "limit", required: false, example: 50 })
  @ApiQuery({ name: "before", required: false, example: "2026-04-01T00:00:00.000Z" })
  @ApiQuery({ name: "category", required: false, example: "membership" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        items: { type: "array", items: { type: "object", additionalProperties: true } },
        page: { type: "object", additionalProperties: true }
      }
    })
  })
  async queryAuditLogs(
    @Query() query: Record<string, unknown>,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const input = parseWithSchema(queryAuditLogSchema, query, "query");
    const result = await this.auditService.queryWorkspaceEvents({
      workspaceId: workspace.workspaceId,
      limit: input.limit,
      ...(input.before ? { before: new Date(input.before) } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.eventType ? { eventType: input.eventType } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {})
    });

    return {
      workspaceId: workspace.workspaceId,
      ...result
    };
  }
}
