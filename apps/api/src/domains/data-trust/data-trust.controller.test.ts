import { describe, expect, it } from "vitest";

import { DataTrustController } from "./data-trust.controller";

describe("DataTrustController", () => {
  it("constructs", () => {
    const controller = new DataTrustController({} as never);
    expect(controller).toBeInstanceOf(DataTrustController);
  });
});
