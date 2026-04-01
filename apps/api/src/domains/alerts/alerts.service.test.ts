import { describe, expect, it } from "vitest";

import { AlertsService } from "./alerts.service";

describe("AlertsService", () => {
  it("constructs", () => {
    const service = new AlertsService();
    expect(service).toBeInstanceOf(AlertsService);
  });
});
