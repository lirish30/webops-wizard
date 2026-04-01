import { describe, expect, it } from "vitest";

import { BackgroundJobsController } from "./background-jobs.controller";

describe("BackgroundJobsController", () => {
  it("constructs", () => {
    const controller = new BackgroundJobsController({} as never);
    expect(controller).toBeInstanceOf(BackgroundJobsController);
  });
});
