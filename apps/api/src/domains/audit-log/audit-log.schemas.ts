import { AuditEventCategory } from "@prisma/client";
import { z } from "zod";

export const queryAuditLogSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
  category: z.nativeEnum(AuditEventCategory).optional(),
  eventType: z.string().min(1).max(120).optional(),
  targetType: z.string().min(1).max(120).optional(),
  targetId: z.string().min(1).max(120).optional(),
  actorUserId: z.string().uuid().optional()
});

export type QueryAuditLogInput = z.infer<typeof queryAuditLogSchema>;

