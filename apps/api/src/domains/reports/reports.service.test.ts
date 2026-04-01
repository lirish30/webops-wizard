import { describe, expect, it } from "vitest";

import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("constructs", () => {
    const service = new ReportsService();
    expect(service).toBeInstanceOf(ReportsService);
  });
});
