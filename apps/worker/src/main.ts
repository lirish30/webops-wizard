import { getWorkerEnv } from "./config/env";
import { getRegisteredJobs } from "./jobs";

export function bootstrapWorker() {
  const env = getWorkerEnv();
  const jobs = getRegisteredJobs();

  return {
    concurrency: env.WORKER_CONCURRENCY,
    jobs
  };
}

if (process.env.NODE_ENV !== "test") {
  const worker = bootstrapWorker();
  console.log(
    `[worker] ready with concurrency=${worker.concurrency} jobs=${worker.jobs.length}`
  );
}
