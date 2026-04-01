import { describe, expect, it } from "vitest";

import {
  generateRecommendationSchema,
  listRecommendationsQuerySchema
} from "./recommendations.dto";

describe("Recommendations DTO", () => {
  it("parses list query", () => {
    const parsed = listRecommendationsQuerySchema.parse({ page: "1", pageSize: "25" });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
  });

  it("parses generate body", () => {
    const parsed = generateRecommendationSchema.parse({ title: "Improve LCP" });
    expect(parsed.title).toBe("Improve LCP");
  });
});
