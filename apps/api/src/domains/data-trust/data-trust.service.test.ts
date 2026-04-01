import { describe, expect, it } from "vitest";

import { DataTrustService } from "./data-trust.service";

describe("DataTrustService", () => {
  it("constructs", () => {
    const service = new DataTrustService();
    expect(service).toBeInstanceOf(DataTrustService);
  });
});
