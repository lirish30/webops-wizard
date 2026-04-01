import { describe, expect, it } from "vitest";

import { IntegrationsController } from "./integrations.controller";

describe("IntegrationsController", () => {
  it("constructs", () => {
    const controller = new IntegrationsController(
      {} as never,
      {} as never,
      {} as never
    );
    expect(controller).toBeInstanceOf(IntegrationsController);
  });
});
