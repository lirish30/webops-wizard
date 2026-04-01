import { describe, expect, it } from "vitest";

import { PagesService } from "./pages.service";

describe("PagesService", () => {
  it("constructs", () => {
    const service = new PagesService();
    expect(service).toBeInstanceOf(PagesService);
  });
});
