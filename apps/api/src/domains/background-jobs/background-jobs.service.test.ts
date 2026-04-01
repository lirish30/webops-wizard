import { describe, expect, it } from "vitest";

import { BackgroundJobsService, isWorkflowQueueName } from "./background-jobs.service";

describe("BackgroundJobsService", () => {
  it("constructs", () => {
    const service = new BackgroundJobsService();
    expect(service).toBeInstanceOf(BackgroundJobsService);
  });

  it("guards known workflow queue names", () => {
    expect(isWorkflowQueueName("connector-sync")).toBe(true);
    expect(isWorkflowQueueName("unknown-queue")).toBe(false);
  });
});
