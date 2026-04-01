import { describe, expect, it } from "vitest";

import { IntegrationsService } from "./integrations.service";

describe("IntegrationsService", () => {
  it("constructs", () => {
    const service = new IntegrationsService();
    expect(service).toBeInstanceOf(IntegrationsService);
  });
});
