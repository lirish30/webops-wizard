import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import {
  workflowQueueNames,
  type BaseWorkflowPayload,
  type WorkflowPayloadByQueue,
  type WorkflowQueueName
} from "@webops-wizard/types";
import { z } from "zod";

import { getWorkerEnv } from "../config/env";
import { workerProcessors } from "./processors";

const basePayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid().nullable().optional(),
  integrationConnectionId: z.string().uuid().optional(),
  trigger: z.enum(["manual", "schedule", "retry", "webhook"]).optional(),
  requestedByUserId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1),
  requestedAt: z.string().datetime()
});

const payloadSchemas: Record<WorkflowQueueName, z.ZodTypeAny> = {
  "connector-sync": basePayloadSchema.extend({
    integrationConnectionId: z.string().uuid(),
    trigger: z.enum(["manual", "schedule", "retry"])
  }),
  "crawl-ingestion": basePayloadSchema,
  "page-identity-resolution": basePayloadSchema,
  "metric-aggregation": basePayloadSchema,
  "trust-scoring": basePayloadSchema,
  "recommendation-generation": basePayloadSchema,
  "report-generation": basePayloadSchema,
  "alert-evaluation": basePayloadSchema,
  "cache-refresh": basePayloadSchema
};

export interface WorkerRuntime {
  queues: Queue[];
  workers: Worker[];
  close(): Promise<void>;
}

function parsePayload<TQueue extends WorkflowQueueName>(
  queueName: TQueue,
  payload: unknown
): WorkflowPayloadByQueue[TQueue] {
  return payloadSchemas[queueName].parse(payload) as WorkflowPayloadByQueue[TQueue];
}

async function handleJob<TQueue extends WorkflowQueueName>(
  queueName: TQueue,
  job: Job<BaseWorkflowPayload>
) {
  const payload = parsePayload(queueName, job.data);
  const processor = workerProcessors[queueName] as (
    payload: WorkflowPayloadByQueue[TQueue],
    context: { queueName: WorkflowQueueName }
  ) => Promise<Record<string, unknown>>;

  const result = await processor(payload, { queueName });
  await job.updateProgress(100);
  return result;
}

export function startWorkerRuntime(): WorkerRuntime {
  const env = getWorkerEnv();
  const redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  const workers = workflowQueueNames.map(
    (queueName) =>
      new Worker(
        queueName,
        async (job) => handleJob(queueName, job as Job<BaseWorkflowPayload>),
        {
          connection: redis,
          concurrency: env.WORKER_CONCURRENCY
        }
      )
  );

  const queues = workflowQueueNames.map(
    (queueName) =>
      new Queue(queueName, {
        connection: redis,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: {
            age: 86400,
            count: 5000
          },
          removeOnFail: {
            age: 604800,
            count: 5000
          }
        }
      })
  );

  return {
    queues,
    workers,
    async close() {
      await Promise.all(workers.map(async (worker) => worker.close()));
      await Promise.all(queues.map(async (queue) => queue.close()));
      await redis.quit();
    }
  };
}
