import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class WorkspacesService {
  async getWorkspaceSwitcher(userId: string, activeWorkspaceId: string | null) {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }]
    });

    const workspaceSummaries = memberships.map((membership) => ({
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      workspaceSlug: membership.workspace.slug,
      role: membership.role,
      lastActiveAt: membership.lastActiveAt?.toISOString() ?? null,
      isActive: membership.workspace.id === activeWorkspaceId
    }));

    const recentWorkspaces = workspaceSummaries
      .filter((workspace) => workspace.lastActiveAt !== null)
      .slice(0, 5);

    return {
      activeWorkspaceId,
      recentWorkspaces,
      workspaces: workspaceSummaries
    };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        planTier: true,
        region: true,
        status: true,
        ownerUserId: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found.");
    }
    return workspace;
  }

  async listMemberships(workspaceId: string) {
    return prisma.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });
  }

  async updateMembershipRole(input: {
    workspaceId: string;
    membershipId: string;
    role: MembershipRole;
    actorUserId: string;
  }) {
    const [actorMembership, targetMembership] = await Promise.all([
      prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: input.actorUserId
          }
        }
      }),
      prisma.workspaceMembership.findFirst({
        where: {
          id: input.membershipId,
          workspaceId: input.workspaceId
        }
      })
    ]);

    if (!actorMembership) {
      throw new ForbiddenException("Not a member of this workspace.");
    }
    if (!targetMembership) {
      throw new NotFoundException("Membership not found in workspace.");
    }

    const actorIsOwner = actorMembership.role === MembershipRole.owner;
    const targetIsOwner = targetMembership.role === MembershipRole.owner;
    const nextIsOwner = input.role === MembershipRole.owner;
    if (!actorIsOwner && (targetIsOwner || nextIsOwner)) {
      throw new ForbiddenException("Only workspace owners can assign or change owner roles.");
    }

    if (targetIsOwner && !nextIsOwner) {
      const ownersInWorkspace = await prisma.workspaceMembership.count({
        where: {
          workspaceId: input.workspaceId,
          role: MembershipRole.owner
        }
      });
      if (ownersInWorkspace <= 1) {
        throw new BadRequestException("A workspace must retain at least one owner.");
      }
    }

    const updatedMembership = await prisma.workspaceMembership.update({
      where: { id: input.membershipId },
      data: { role: input.role }
    });

    return {
      membership: updatedMembership,
      previousRole: targetMembership.role
    };
  }

  async removeMembership(input: {
    workspaceId: string;
    membershipId: string;
    actorUserId: string;
  }) {
    const [actorMembership, targetMembership] = await Promise.all([
      prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: input.actorUserId
          }
        }
      }),
      prisma.workspaceMembership.findFirst({
        where: {
          id: input.membershipId,
          workspaceId: input.workspaceId
        }
      })
    ]);

    if (!actorMembership) {
      throw new ForbiddenException("Not a member of this workspace.");
    }
    if (!targetMembership) {
      throw new NotFoundException("Membership not found in workspace.");
    }

    const actorIsOwner = actorMembership.role === MembershipRole.owner;
    const targetIsOwner = targetMembership.role === MembershipRole.owner;
    if (!actorIsOwner && targetIsOwner) {
      throw new ForbiddenException("Only workspace owners can remove an owner.");
    }

    if (targetIsOwner) {
      const ownersInWorkspace = await prisma.workspaceMembership.count({
        where: {
          workspaceId: input.workspaceId,
          role: MembershipRole.owner
        }
      });
      if (ownersInWorkspace <= 1) {
        throw new BadRequestException("A workspace must retain at least one owner.");
      }
    }

    await prisma.workspaceMembership.delete({
      where: { id: input.membershipId }
    });

    return targetMembership;
  }
}
