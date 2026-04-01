import type { AuditActorType, AuditEventCategory } from "@prisma/client";
import type { FastifyRequest } from "fastify";

export type RequestAuditContext = {
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  workspaceIdHint: string | null;
  hasSessionCookie: boolean;
};

export type AuditContextRequest = FastifyRequest & {
  auditContext?: RequestAuditContext;
};

export type AuditEventInput = {
  workspaceId: string;
  actorUserId?: string | null;
  actorType?: AuditActorType;
  category: AuditEventCategory;
  eventType: string;
  targetType?: string | null;
  targetId?: string | null;
  metadataJson?: Record<string, unknown> | null;
  occurredAt?: Date;
};
