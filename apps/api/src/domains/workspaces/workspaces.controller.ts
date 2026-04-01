import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
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
  CurrentActor,
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import {
  updateMembershipRoleSchema
} from "./workspaces.schemas";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
@ApiTags("workspaces")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly auditService: AuditService
  ) {}

  @Get("switcher")
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List workspaces for workspace switcher" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      additionalProperties: true
    })
  })
  async getSwitcher(
    @CurrentActor() actor: { userId: string; activeWorkspaceId: string | null }
  ) {
    return this.workspacesService.getWorkspaceSwitcher(actor.userId, actor.activeWorkspaceId);
  }

  @Get(":workspaceId")
  @UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
  @RequireWorkspaceCapabilities("workspace.read")
  @ApiOperation({ summary: "Get workspace details" })
  async getWorkspace(@CurrentWorkspace() workspace: WorkspaceAccess) {
    return this.workspacesService.getWorkspace(workspace.workspaceId);
  }

  @Get(":workspaceId/memberships")
  @UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
  @RequireWorkspaceCapabilities("workspace.memberships.read")
  @ApiOperation({ summary: "List workspace memberships" })
  async listMemberships(@CurrentWorkspace() workspace: WorkspaceAccess) {
    return {
      workspaceId: workspace.workspaceId,
      memberships: await this.workspacesService.listMemberships(workspace.workspaceId)
    };
  }

  @Patch(":workspaceId/memberships/:membershipId")
  @UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
  @RequireWorkspaceCapabilities("workspace.memberships.manage")
  @ApiOperation({ summary: "Update membership role" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        role: { type: "string", example: "manager" }
      },
      required: ["role"]
    }
  })
  async patchMembershipRole(
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentActor() actor: { userId: string },
    @Req() request: FastifyRequest
  ) {
    const input = parseWithSchema(updateMembershipRoleSchema, body);
    const result = await this.workspacesService.updateMembershipRole({
      workspaceId: workspace.workspaceId,
      membershipId,
      role: input.role,
      actorUserId: actor.userId
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: actor.userId,
        category: "membership",
        eventType: "membership.role_changed",
        targetType: "workspace_membership",
        targetId: membershipId,
        metadataJson: {
          previousRole: result.previousRole,
          nextRole: result.membership.role
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      membershipId: result.membership.id,
      userId: result.membership.userId,
      role: result.membership.role
    };
  }

  @Delete(":workspaceId/memberships/:membershipId")
  @UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
  @RequireWorkspaceCapabilities("workspace.memberships.manage")
  @ApiOperation({ summary: "Remove membership from workspace" })
  async removeMembership(
    @Param("membershipId") membershipId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentActor() actor: { userId: string },
    @Req() request: FastifyRequest
  ) {
    const removedMembership = await this.workspacesService.removeMembership({
      workspaceId: workspace.workspaceId,
      membershipId,
      actorUserId: actor.userId
    });

    await this.auditService.record(
      {
        workspaceId: workspace.workspaceId,
        actorUserId: actor.userId,
        category: "membership",
        eventType: "membership.removed",
        targetType: "workspace_membership",
        targetId: removedMembership.id,
        metadataJson: {
          removedUserId: removedMembership.userId,
          removedRole: removedMembership.role
        }
      },
      request
    );

    return {
      workspaceId: workspace.workspaceId,
      membershipId: removedMembership.id,
      removed: true
    };
  }
}
