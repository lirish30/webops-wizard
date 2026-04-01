import { describe, expect, it } from "vitest";

import { RecommendationsService } from "./recommendations.service";

describe("RecommendationsService", () => {
  it("constructs", () => {
    const service = new RecommendationsService();
    expect(service).toBeInstanceOf(RecommendationsService);
  });
});
