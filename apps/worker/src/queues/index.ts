import {
  workflowQueueNames,
  type QueueContract,
  type WorkflowPayloadByQueue,
  type WorkflowQueueName
} from "@webops-wizard/types";

export const queueNames = workflowQueueNames;

export type QueueName = WorkflowQueueName;

export function createQueueContract<TQueue extends QueueName>(
  name: TQueue,
  payload: WorkflowPayloadByQueue[TQueue]
): QueueContract<WorkflowPayloadByQueue[TQueue]> {
  return {
    name,
    payload,
    version: 1
  };
}
