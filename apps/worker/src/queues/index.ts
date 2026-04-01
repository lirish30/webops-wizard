import type { QueueContract } from "@webops-wizard/types";

export const queueNames = [
  "connector-sync",
  "crawl",
  "page-intelligence",
  "trust-scoring",
  "recommendation-generation",
  "report-generation",
  "alert-evaluation",
  "cache-refresh"
] as const;

export type QueueName = (typeof queueNames)[number];

export function createQueueContract<TPayload>(
  name: QueueName,
  payload: TPayload
): QueueContract<TPayload> {
  return {
    name,
    payload,
    version: 1
  };
}
