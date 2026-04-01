import { describe, expect, it } from "vitest";

import { RecommendationsController } from "./recommendations.controller";

describe("RecommendationsController", () => {
  it("constructs", () => {
    const controller = new RecommendationsController({} as never, {} as never);
    expect(controller).toBeInstanceOf(RecommendationsController);
  });
});
