import { describe, expect, it } from "vitest";

import { ReleasesController } from "./releases.controller";

describe("ReleasesController", () => {
  it("constructs", () => {
    const controller = new ReleasesController({} as never);
    expect(controller).toBeInstanceOf(ReleasesController);
  });
});
