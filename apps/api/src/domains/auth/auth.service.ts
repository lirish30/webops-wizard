import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  IdentityProviderStatus,
  IdentityProviderType,
  MembershipRole,
  UserStatus
} from "@prisma/client";
import { prisma } from "@webops-wizard/db";
import type { FastifyRequest } from "fastify";

import { AuditService } from "../../common/audit/audit.service";
import { getApiEnv, type ApiEnv } from "../../config/env";
import { hasWorkspaceCapability } from "../../common/security/workspace-policy";
import { getAccessTokenCookie, getRefreshTokenCookie } from "./auth.cookies";
import type {
  AcceptInviteInput,
  CreateInviteInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput
} from "./auth.schemas";
import {
  generateRandomToken,
  hashSecret,
  normalizeEmail,
  signAccessToken,
  verifyAccessToken,
  verifySecret
} from "./auth.security";

type RequestMeta = {
  userAgent: string | null;
  ipAddress: string | null;
};

type SessionOutput = {
  user: {
    id: string;
    email: string;
    fullName: string;
    status: UserStatus;
  };
  activeWorkspaceId: string | null;
  memberships: Array<{
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    role: MembershipRole;
  }>;
};

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  session: SessionOutput;
};

function createWorkspaceSlug(fullName: string): string {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = generateRandomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  return `${base || "workspace"}-${suffix}`;
}

function parseCompoundToken(rawToken: string): { id: string; secret: string } {
  const [id, secret] = rawToken.split(".");
  if (!id || !secret) {
    throw new UnauthorizedException("Invalid token format.");
  }
  return { id, secret };
}

@Injectable()
export class AuthService {
  private readonly env: ApiEnv = getApiEnv();

  constructor(private readonly auditService: AuditService) {}

  private issueAccessToken(input: {
    userId: string;
    sessionId: string;
    activeWorkspaceId: string | null;
  }): string {
    return signAccessToken(
      {
        sub: input.userId,
        sid: input.sessionId,
        typ: "access",
        activeWorkspaceId: input.activeWorkspaceId
      },
      this.env.JWT_SECRET,
      this.env.ACCESS_TOKEN_TTL_SECONDS
    );
  }

  private async buildSessionOutput(input: {
    userId: string;
    activeWorkspaceId: string | null;
  }): Promise<SessionOutput> {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: {
        memberships: {
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
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException("Session user no longer exists.");
    }

    const memberships = user.memberships.map((membership) => ({
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      workspaceSlug: membership.workspace.slug,
      role: membership.role
    }));

    const activeWorkspaceId =
      memberships.find((membership) => membership.workspaceId === input.activeWorkspaceId)
        ?.workspaceId ??
      memberships[0]?.workspaceId ??
      null;

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status
      },
      memberships,
      activeWorkspaceId
    };
  }

  private async createSessionForUser(params: {
    userId: string;
    activeWorkspaceId: string | null;
    meta: RequestMeta;
  }): Promise<AuthResult> {
    const refreshSecret = generateRandomToken(48);
    const refreshTokenHash = hashSecret(refreshSecret);
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000);

    const createdSession = await prisma.authSession.create({
      data: {
        userId: params.userId,
        refreshTokenHash,
        activeWorkspaceId: params.activeWorkspaceId,
        userAgent: params.meta.userAgent,
        ipAddress: params.meta.ipAddress,
        expiresAt,
        lastUsedAt: new Date()
      }
    });

    const refreshToken = `${createdSession.id}.${refreshSecret}`;
    const accessToken = this.issueAccessToken({
      userId: params.userId,
      sessionId: createdSession.id,
      activeWorkspaceId: params.activeWorkspaceId
    });

    const session = await this.buildSessionOutput({
      userId: params.userId,
      activeWorkspaceId: params.activeWorkspaceId
    });

    return {
      accessToken,
      refreshToken,
      session
    };
  }

  private async rotateRefreshToken(rawRefreshToken: string): Promise<AuthResult> {
    const { id: sessionId, secret } = parseCompoundToken(rawRefreshToken);
    const existingSession = await prisma.authSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession || existingSession.revokedAt || existingSession.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired.");
    }

    const isTokenValid = verifySecret(secret, existingSession.refreshTokenHash);
    if (!isTokenValid) {
      await prisma.authSession.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() }
      });
      throw new UnauthorizedException("Refresh token invalid.");
    }

    const refreshSecret = generateRandomToken(48);
    const nextRefreshTokenHash = hashSecret(refreshSecret);
    const nextExpiry = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000);

    const updatedSession = await prisma.authSession.update({
      where: { id: existingSession.id },
      data: {
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt: nextExpiry,
        lastUsedAt: new Date()
      }
    });

    const session = await this.buildSessionOutput({
      userId: updatedSession.userId,
      activeWorkspaceId: updatedSession.activeWorkspaceId
    });

    const accessToken = this.issueAccessToken({
      userId: updatedSession.userId,
      sessionId: updatedSession.id,
      activeWorkspaceId: session.activeWorkspaceId
    });

    return {
      accessToken,
      refreshToken: `${updatedSession.id}.${refreshSecret}`,
      session
    };
  }

  private getRequestMeta(request: FastifyRequest): RequestMeta {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null
    };
  }

  async signUp(input: SignUpInput, request: FastifyRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException("Account already exists.");
    }

    const activeInvite = await prisma.workspaceInvite.findFirst({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (activeInvite) {
      throw new ConflictException("This email must complete invite acceptance.");
    }

    const passwordHash = hashSecret(input.password);
    const meta = this.getRequestMeta(request);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: input.fullName.trim(),
          passwordHash,
          status: UserStatus.active
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${input.fullName.trim()}'s Workspace`,
          slug: createWorkspaceSlug(input.fullName),
          ownerUserId: user.id
        }
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: MembershipRole.owner,
          lastActiveAt: new Date()
        }
      });

      return { user, workspace };
    });

    return this.createSessionForUser({
      userId: created.user.id,
      activeWorkspaceId: created.workspace.id,
      meta
    });
  }

  async signIn(input: SignInInput, request: FastifyRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }]
        }
      }
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    if (!verifySecret(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    if (user.status === UserStatus.invited) {
      throw new ForbiddenException("Accept your invite before signing in.");
    }

    const preferredWorkspaceId = user.memberships[0]?.workspaceId ?? null;
    return this.createSessionForUser({
      userId: user.id,
      activeWorkspaceId: preferredWorkspaceId,
      meta: this.getRequestMeta(request)
    });
  }

  async signOut(request: FastifyRequest): Promise<void> {
    const refreshToken = getRefreshTokenCookie(request);
    if (!refreshToken) {
      return;
    }

    const parsed = refreshToken.split(".");
    if (parsed.length !== 2) {
      return;
    }

    const sessionId = parsed[0];
    if (!sessionId) {
      return;
    }
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async getSession(request: FastifyRequest, allowRefresh = true): Promise<AuthResult | SessionOutput> {
    const accessToken = getAccessTokenCookie(request);
    if (accessToken) {
      const { payload } = verifyAccessToken(accessToken, this.env.JWT_SECRET);
      if (payload) {
        const session = await prisma.authSession.findUnique({ where: { id: payload.sid } });
        if (session && !session.revokedAt && session.expiresAt > new Date()) {
          return this.buildSessionOutput({
            userId: payload.sub,
            activeWorkspaceId: session.activeWorkspaceId
          });
        }
      }
    }

    if (!allowRefresh) {
      throw new UnauthorizedException("Session unavailable.");
    }

    const refreshToken = getRefreshTokenCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException("Session unavailable.");
    }

    return this.rotateRefreshToken(refreshToken);
  }

  async refresh(request: FastifyRequest): Promise<AuthResult> {
    const refreshToken = getRefreshTokenCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token missing.");
    }
    return this.rotateRefreshToken(refreshToken);
  }

  async requestPasswordReset(input: ForgotPasswordInput): Promise<{ success: boolean; resetLink?: string }> {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return { success: true };
    }

    const rawSecret = generateRandomToken(48);
    const tokenRecord = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(rawSecret),
        expiresAt: new Date(Date.now() + this.env.PASSWORD_RESET_TTL_SECONDS * 1000)
      }
    });

    const resetToken = `${tokenRecord.id}.${rawSecret}`;
    const response: { success: boolean; resetLink?: string } = { success: true };
    if (this.env.NODE_ENV !== "production") {
      response.resetLink = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    }
    return response;
  }

  async resetPassword(input: ResetPasswordInput, request: FastifyRequest): Promise<AuthResult> {
    const { id, secret } = parseCompoundToken(input.token);
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { id }
    });

    if (
      !tokenRecord ||
      tokenRecord.consumedAt ||
      tokenRecord.expiresAt < new Date() ||
      !verifySecret(secret, tokenRecord.tokenHash)
    ) {
      throw new BadRequestException("Reset token is invalid or expired.");
    }

    const nextPasswordHash = hashSecret(input.newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash: nextPasswordHash,
          status: UserStatus.active
        }
      });
      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() }
      });
      await tx.authSession.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });

    const userMembership = await prisma.workspaceMembership.findFirst({
      where: { userId: tokenRecord.userId },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }]
    });

    return this.createSessionForUser({
      userId: tokenRecord.userId,
      activeWorkspaceId: userMembership?.workspaceId ?? null,
      meta: this.getRequestMeta(request)
    });
  }

  async createInvite(input: CreateInviteInput, request: FastifyRequest): Promise<{
    inviteId: string;
    workspaceId: string;
    email: string;
    role: MembershipRole;
    acceptanceLink?: string;
  }> {
    const actor = await this.requireAuthenticatedUser(request);
    const actorMembership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId: input.workspaceId, userId: actor.userId }
    });

    if (!actorMembership) {
      throw new ForbiddenException("Not a member of this workspace.");
    }
    if (!hasWorkspaceCapability(actorMembership.role, "workspace.invites.manage")) {
      throw new ForbiddenException("Insufficient permissions to invite members.");
    }
    if (
      input.role === MembershipRole.owner &&
      actorMembership.role !== MembershipRole.owner
    ) {
      throw new ForbiddenException("Only workspace owners can invite another owner.");
    }

    const inviteEmail = normalizeEmail(input.email);
    await prisma.workspaceInvite.updateMany({
      where: {
        workspaceId: input.workspaceId,
        email: inviteEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { expiresAt: new Date() }
    });

    const rawSecret = generateRandomToken(48);
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: input.workspaceId,
        email: inviteEmail,
        role: input.role,
        inviterUserId: actor.userId,
        tokenHash: hashSecret(rawSecret),
        expiresAt: new Date(Date.now() + this.env.INVITE_TTL_SECONDS * 1000)
      }
    });

    const result: {
      inviteId: string;
      workspaceId: string;
      email: string;
      role: MembershipRole;
      acceptanceLink?: string;
    } = {
      inviteId: invite.id,
      workspaceId: invite.workspaceId,
      email: invite.email,
      role: invite.role
    };

    if (this.env.NODE_ENV !== "production") {
      result.acceptanceLink = `${this.env.APP_URL}/accept-invite?token=${encodeURIComponent(`${invite.id}.${rawSecret}`)}`;
    }

    await this.auditService.record(
      {
        workspaceId: input.workspaceId,
        actorUserId: actor.userId,
        category: "membership",
        eventType: "membership.invite_created",
        targetType: "workspace_invite",
        targetId: invite.id,
        metadataJson: {
          email: invite.email,
          role: invite.role
        }
      },
      request
    );

    return result;
  }

  async acceptInvite(input: AcceptInviteInput, request: FastifyRequest): Promise<AuthResult> {
    const { id, secret } = parseCompoundToken(input.token);
    const invite = await prisma.workspaceInvite.findUnique({
      where: { id }
    });

    if (
      !invite ||
      invite.acceptedAt ||
      invite.expiresAt < new Date() ||
      !verifySecret(secret, invite.tokenHash)
    ) {
      throw new BadRequestException("Invite token is invalid or expired.");
    }

    const email = normalizeEmail(invite.email);
    const now = new Date();

    const accepted = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        if (!input.fullName || !input.password) {
          throw new BadRequestException(
            "New invited users must provide full name and password."
          );
        }
        user = await tx.user.create({
          data: {
            email,
            fullName: input.fullName.trim(),
            passwordHash: hashSecret(input.password),
            status: UserStatus.active
          }
        });
      }

      await tx.workspaceMembership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id
          }
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          lastActiveAt: now
        },
        update: {
          role: invite.role,
          lastActiveAt: now
        }
      });

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: now,
          acceptedUserId: user.id
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { status: UserStatus.active }
      });

      return user;
    });

    await this.auditService.record(
      {
        workspaceId: invite.workspaceId,
        actorUserId: accepted.id,
        category: "membership",
        eventType: "membership.invite_accepted",
        targetType: "workspace_invite",
        targetId: invite.id,
        metadataJson: {
          email
        }
      },
      request
    );

    return this.createSessionForUser({
      userId: accepted.id,
      activeWorkspaceId: invite.workspaceId,
      meta: this.getRequestMeta(request)
    });
  }

  async getProviders() {
    const configuredProviders = await prisma.identityProvider.findMany();
    const byType = new Map(configuredProviders.map((provider) => [provider.type, provider]));

    const defaults: Array<{
      type: IdentityProviderType;
      label: string;
      status: IdentityProviderStatus;
    }> = [
      {
        type: IdentityProviderType.local,
        label: "Email and password",
        status: IdentityProviderStatus.enabled
      },
      {
        type: IdentityProviderType.google_oauth,
        label: "Google",
        status: IdentityProviderStatus.coming_soon
      },
      {
        type: IdentityProviderType.microsoft_oauth,
        label: "Microsoft",
        status: IdentityProviderStatus.coming_soon
      },
      {
        type: IdentityProviderType.saml,
        label: "SAML",
        status: IdentityProviderStatus.coming_soon
      }
    ];

    return defaults.map((provider) => {
      const configured = byType.get(provider.type);
      return {
        type: provider.type,
        label: configured?.displayName ?? provider.label,
        status: configured?.status ?? provider.status
      };
    });
  }

  async startProvider(providerType: IdentityProviderType) {
    return {
      provider: providerType,
      status: "coming_soon" as const,
      message: "SSO provider wiring will be added in a future release."
    };
  }

  async requireAuthenticatedUser(request: FastifyRequest): Promise<{
    userId: string;
    sessionId: string;
    activeWorkspaceId: string | null;
  }> {
    const accessToken = getAccessTokenCookie(request);
    if (!accessToken) {
      throw new UnauthorizedException("Authentication required.");
    }

    const verified = verifyAccessToken(accessToken, this.env.JWT_SECRET);
    if (!verified.payload) {
      throw new UnauthorizedException("Authentication required.");
    }

    return {
      userId: verified.payload.sub,
      sessionId: verified.payload.sid,
      activeWorkspaceId: verified.payload.activeWorkspaceId
    };
  }

  async switchActiveWorkspace(request: FastifyRequest, workspaceId: string): Promise<AuthResult> {
    const actor = await this.requireAuthenticatedUser(request);
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: actor.userId
        }
      }
    });

    if (!membership) {
      throw new NotFoundException("Workspace not found for current user.");
    }

    await prisma.authSession.updateMany({
      where: {
        id: actor.sessionId,
        userId: actor.userId,
        revokedAt: null
      },
      data: {
        activeWorkspaceId: workspaceId,
        lastUsedAt: new Date()
      }
    });

    await prisma.workspaceMembership.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: actor.userId
        }
      },
      data: { lastActiveAt: new Date() }
    });

    const refreshToken = getRefreshTokenCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token missing.");
    }
    const rotated = await this.rotateRefreshToken(refreshToken);
    return {
      ...rotated,
      session: {
        ...rotated.session,
        activeWorkspaceId: workspaceId
      }
    };
  }
}
