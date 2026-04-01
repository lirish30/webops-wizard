import { queueNames } from "../queues";

export function getRegisteredJobs() {
  return queueNames.map((name) => ({
    name,
    description: `BullMQ processor for ${name}`
  }));
}
