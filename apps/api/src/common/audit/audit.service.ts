import { Injectable } from "@nestjs/common";
import {
  AuditActorType,
  Prisma,
  type AuditEventCategory
} from "@prisma/client";
import { prisma } from "@webops-wizard/db";
import type { FastifyRequest } from "fastify";

import type { AuditContextRequest, AuditEventInput } from "./audit.types";

@Injectable()
export class AuditService {
  async record(input: AuditEventInput, request?: FastifyRequest) {
    const contextRequest = request as AuditContextRequest | undefined;
    const context = contextRequest?.auditContext;
    const actorType =
      input.actorType ??
      (input.actorUserId ? AuditActorType.user : AuditActorType.system);

    const data: Prisma.AuditLogEventUncheckedCreateInput = {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      actorType,
      category: input.category,
      eventType: input.eventType,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: context?.requestId ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      ...(input.metadataJson
        ? { metadataJson: input.metadataJson as Prisma.InputJsonValue }
        : {})
    };

    return prisma.auditLogEvent.create({ data });
  }

  async queryWorkspaceEvents(input: {
    workspaceId: string;
    limit: number;
    before?: Date;
    category?: AuditEventCategory;
    eventType?: string;
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
  }) {
    const where: Prisma.AuditLogEventWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.before ? { occurredAt: { lt: input.before } } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.eventType ? { eventType: input.eventType } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {})
    };

    const events = await prisma.auditLogEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.limit
    });

    const nextBefore = events.length === input.limit ? events[events.length - 1]?.occurredAt : null;

    return {
      items: events.map((event) => ({
        id: event.id,
        workspaceId: event.workspaceId,
        actorUserId: event.actorUserId,
        actorType: event.actorType,
        category: event.category,
        eventType: event.eventType,
        targetType: event.targetType,
        targetId: event.targetId,
        metadataJson: event.metadataJson,
        requestId: event.requestId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        occurredAt: event.occurredAt.toISOString()
      })),
      page: {
        limit: input.limit,
        nextBefore: nextBefore ? nextBefore.toISOString() : null
      }
    };
  }
}
