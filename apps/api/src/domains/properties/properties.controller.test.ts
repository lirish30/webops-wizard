import { describe, expect, it } from "vitest";

import { PropertiesController } from "./properties.controller";

describe("PropertiesController", () => {
  it("constructs", () => {
    const controller = new PropertiesController({} as never, {} as never);
    expect(controller).toBeInstanceOf(PropertiesController);
  });
});
