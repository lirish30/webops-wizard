import { describe, expect, it } from "vitest";

import { updateIntegrationSchema } from "./integrations.dto";

describe("Integrations DTO", () => {
  it("accepts partial update payload", () => {
    const parsed = updateIntegrationSchema.parse({ status: "connected" });
    expect(parsed.status).toBe("connected");
  });
});
