import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import {
  workflowQueueNames,
  type BaseWorkflowPayload,
  type WorkflowQueueName
} from "@webops-wizard/types";

import type {
  EnqueueBackgroundJobDto,
  ListWorkflowJobsQueryDto
} from "./background-jobs.dto";

const JOB_STATES = [
  "active",
  "waiting",
  "delayed",
  "prioritized",
  "completed",
  "failed"
] as const;

@Injectable()
export class BackgroundJobsService implements OnModuleDestroy {
  private redis: IORedis | null = null;
  private readonly queues = new Map<WorkflowQueueName, Queue<BaseWorkflowPayload>>();

  private getRedisClient() {
    if (this.redis) {
      return this.redis;
    }

    this.redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    return this.redis;
  }

  private getQueue(queueName: WorkflowQueueName): Queue<BaseWorkflowPayload> {
    const existing = this.queues.get(queueName);

    if (existing) {
      return existing;
    }

    const queue = new Queue<BaseWorkflowPayload>(queueName, {
      connection: this.getRedisClient(),
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
    });

    this.queues.set(queueName, queue);
    return queue;
  }

  private buildDefaultIdempotencyKey(input: {
    workflow: WorkflowQueueName;
    workspaceId: string;
    propertyId?: string | undefined;
    integrationConnectionId?: string | undefined;
    trigger?: "manual" | "schedule" | "retry" | "webhook" | undefined;
    now: Date;
  }) {
    const bucket = input.now.toISOString().slice(0, 16);
    return [
      input.workflow,
      input.workspaceId,
      input.propertyId ?? "all-properties",
      input.integrationConnectionId ?? "all-integrations",
      input.trigger ?? "manual",
      bucket
    ].join(":");
  }

  private toJobStatus(job: Job<BaseWorkflowPayload>, state: string) {
    return {
      id: job.id,
      name: job.name,
      queue: job.queueName,
      state,
      attemptsMade: job.attemptsMade,
      progress: job.progress,
      idempotencyKey: job.data.idempotencyKey,
      data: job.data,
      result: (job.returnvalue as unknown) ?? null,
      failedReason: job.failedReason ?? null,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null
    };
  }

  async enqueueForWorkspace(input: {
    workspaceId: string;
    userId: string;
    body: EnqueueBackgroundJobDto;
  }) {
    const now = new Date();
    const idempotencyKey =
      input.body.idempotencyKey ??
      this.buildDefaultIdempotencyKey({
        workflow: input.body.workflow,
        workspaceId: input.workspaceId,
        propertyId: input.body.propertyId,
        integrationConnectionId: input.body.integrationConnectionId,
        trigger: input.body.trigger,
        now
      });

    if (
      input.body.workflow === "connector-sync" &&
      !input.body.integrationConnectionId
    ) {
      throw new Error("integrationConnectionId is required for connector-sync workflow.");
    }

    const queue = this.getQueue(input.body.workflow);
    const existing = await queue.getJob(idempotencyKey);

    if (existing) {
      const state = await existing.getState();

      return {
        deduplicated: true,
        job: this.toJobStatus(existing, state)
      };
    }

    const job = await queue.add(
      input.body.workflow,
      {
        workspaceId: input.workspaceId,
        propertyId: input.body.propertyId,
        integrationConnectionId: input.body.integrationConnectionId,
        trigger: input.body.trigger ?? "manual",
        requestedByUserId: input.userId,
        idempotencyKey,
        requestedAt: now.toISOString()
      },
      {
        jobId: idempotencyKey
      }
    );

    const state = await job.getState();

    return {
      deduplicated: false,
      job: this.toJobStatus(job, state)
    };
  }

  async getJobStatus(queueName: WorkflowQueueName, jobId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    return this.toJobStatus(job, state);
  }

  async listJobs(
    queueName: WorkflowQueueName,
    query: ListWorkflowJobsQueryDto
  ) {
    const queue = this.getQueue(queueName);
    const jobs = await queue.getJobs(
      [...JOB_STATES],
      0,
      query.limit - 1,
      true
    );

    const statuses = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        return this.toJobStatus(job, state);
      })
    );

    return {
      queue: queueName,
      items: statuses
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.queues.values()].map(async (queue) => queue.close())
    );

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

export function isWorkflowQueueName(value: string): value is WorkflowQueueName {
  return (workflowQueueNames as readonly string[]).includes(value);
}
