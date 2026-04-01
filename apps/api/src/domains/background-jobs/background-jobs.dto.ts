import { workflowQueueNames } from "@webops-wizard/types";
import { z } from "zod";

export const enqueueBackgroundJobSchema = z.object({
  workflow: z.enum(workflowQueueNames),
  propertyId: z.string().uuid().optional(),
  integrationConnectionId: z.string().uuid().optional(),
  trigger: z.enum(["manual", "schedule", "retry", "webhook"]).optional(),
  idempotencyKey: z.string().min(1).max(256).optional()
});

export const listWorkflowJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export type EnqueueBackgroundJobDto = z.infer<typeof enqueueBackgroundJobSchema>;
export type ListWorkflowJobsQueryDto = z.infer<typeof listWorkflowJobsQuerySchema>;
