import { describe, expect, it } from "vitest";

import { ReportsController } from "./reports.controller";

describe("ReportsController", () => {
  it("constructs", () => {
    const controller = new ReportsController({} as never, {} as never);
    expect(controller).toBeInstanceOf(ReportsController);
  });
});
