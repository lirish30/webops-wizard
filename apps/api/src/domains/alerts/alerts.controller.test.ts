import { describe, expect, it } from "vitest";

import { AlertsController } from "./alerts.controller";

describe("AlertsController", () => {
  it("constructs", () => {
    const controller = new AlertsController({} as never);
    expect(controller).toBeInstanceOf(AlertsController);
  });
});
