import { getWorkerEnv } from "./config/env";
import { getRegisteredJobs } from "./jobs";
import { startWorkerRuntime } from "./jobs/runtime";

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
  const runtime = startWorkerRuntime();

  const closeRuntime = async () => {
    await runtime.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void closeRuntime();
  });

  process.once("SIGTERM", () => {
    void closeRuntime();
  });

  console.log(
    `[worker] ready with concurrency=${worker.concurrency} jobs=${worker.jobs.length}`
  );
}
