import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards
} from "@nestjs/common";
import { ZodError } from "zod";

import { AuditService } from "../../common/audit/audit.service";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import { queryAuditLogSchema, type QueryAuditLogInput } from "./audit-log.schemas";

@Controller("audit-logs")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireWorkspaceCapabilities("audit.read")
  async queryAuditLogs(
    @Query() query: Record<string, unknown>,
    @CurrentWorkspace() workspace: WorkspaceAccess
  ) {
    const input = this.parseQuery(query);
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

  private parseQuery(query: Record<string, unknown>): QueryAuditLogInput {
    try {
      return queryAuditLogSchema.parse(query);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues[0]?.message ?? "Invalid query.");
      }
      throw error;
    }
  }
}
