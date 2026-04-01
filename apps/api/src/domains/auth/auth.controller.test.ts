import { describe, expect, it } from "vitest";

import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  it("constructs with service dependency", () => {
    const controller = new AuthController({} as never);
    expect(controller).toBeInstanceOf(AuthController);
  });
});
