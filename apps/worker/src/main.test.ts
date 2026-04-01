import { describe, expect, it } from "vitest";

import { bootstrapWorker } from "./main";

describe("bootstrapWorker", () => {
  it("registers the expected job groups", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/webops";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.WORKER_CONCURRENCY = "3";

    const worker = bootstrapWorker();

    expect(worker.concurrency).toBe(3);
    expect(worker.jobs.length).toBeGreaterThan(3);
  });
});
