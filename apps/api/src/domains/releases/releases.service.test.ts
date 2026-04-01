import { describe, expect, it } from "vitest";

import { ReleasesService } from "./releases.service";

describe("ReleasesService", () => {
  it("constructs", () => {
    const service = new ReleasesService();
    expect(service).toBeInstanceOf(ReleasesService);
  });
});
