import { describe, expect, it } from "vitest";

import { PropertiesService } from "./properties.service";

describe("PropertiesService", () => {
  it("constructs", () => {
    const service = new PropertiesService();
    expect(service).toBeInstanceOf(PropertiesService);
  });
});
