import { queueNames } from "../queues";

export function getRegisteredJobs() {
  return queueNames.map((name) => ({
    name,
    description: `Stub handler for ${name}`
  }));
}
