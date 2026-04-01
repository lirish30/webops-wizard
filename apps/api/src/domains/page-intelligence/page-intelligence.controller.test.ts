import { describe, expect, it } from "vitest";

import { PageIntelligenceController } from "./page-intelligence.controller";

describe("PagesController", () => {
  it("constructs", () => {
    const controller = new PageIntelligenceController({} as never);
    expect(controller).toBeInstanceOf(PageIntelligenceController);
  });
});
