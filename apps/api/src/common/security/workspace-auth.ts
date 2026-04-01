import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@webops-wizard/db";
import type { FastifyRequest } from "fastify";

import { AuthService } from "../../domains/auth/auth.service";
import {
  hasWorkspaceCapability,
  listWorkspaceCapabilities,
  type WorkspaceCapability
} from "./workspace-policy";

const requiredWorkspaceCapabilitiesKey = "requiredWorkspaceCapabilities";

type AuthenticatedActor = {
  userId: string;
  sessionId: string;
  activeWorkspaceId: string | null;
};

export type WorkspaceAccess = {
  userId: string;
  sessionId: string;
  workspaceId: string;
  membershipId: string;
  role: MembershipRole;
  capabilities: WorkspaceCapability[];
};

type AuthedFastifyRequest = FastifyRequest & {
  authActor?: AuthenticatedActor;
  workspaceAccess?: WorkspaceAccess;
};

function resolveWorkspaceIdFromRequest(request: FastifyRequest): string | null {
  const params = request.params as Record<string, unknown>;
  if (typeof params.workspaceId === "string" && params.workspaceId.length > 0) {
    return params.workspaceId;
  }

  const body = request.body as Record<string, unknown> | null;
  if (body && typeof body.workspaceId === "string" && body.workspaceId.length > 0) {
    return body.workspaceId;
  }

  const query = request.query as Record<string, unknown>;
  if (typeof query.workspaceId === "string" && query.workspaceId.length > 0) {
    return query.workspaceId;
  }

  return null;
}

export const RequireWorkspaceCapabilities = (...capabilities: WorkspaceCapability[]) =>
  SetMetadata(requiredWorkspaceCapabilitiesKey, capabilities);

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthedFastifyRequest>();
  if (!request.authActor) {
    throw new ForbiddenException("Authenticated actor is unavailable.");
  }
  return request.authActor;
});

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthedFastifyRequest>();
    if (!request.workspaceAccess) {
      throw new ForbiddenException("Workspace context is unavailable.");
    }
    return request.workspaceAccess;
  }
);

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedFastifyRequest>();
    request.authActor = await this.authService.requireAuthenticatedUser(request);
    return true;
  }
}

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedFastifyRequest>();
    const actor =
      request.authActor ?? (await this.authService.requireAuthenticatedUser(request));

    const requiredCapabilities =
      this.reflector.getAllAndOverride<WorkspaceCapability[]>(
        requiredWorkspaceCapabilitiesKey,
        [context.getHandler(), context.getClass()]
      ) ?? [];

    const workspaceId = resolveWorkspaceIdFromRequest(request) ?? actor.activeWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException("workspaceId is required.");
    }

    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: actor.userId
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException("Not a member of this workspace.");
    }

    for (const capability of requiredCapabilities) {
      if (!hasWorkspaceCapability(membership.role, capability)) {
        throw new ForbiddenException(`Missing capability: ${capability}`);
      }
    }

    request.authActor = actor;
    request.workspaceAccess = {
      userId: actor.userId,
      sessionId: actor.sessionId,
      workspaceId: membership.workspaceId,
      membershipId: membership.id,
      role: membership.role,
      capabilities: listWorkspaceCapabilities(membership.role)
    };

    return true;
  }
}
