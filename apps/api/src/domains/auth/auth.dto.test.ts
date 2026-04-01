import { describe, expect, it } from "vitest";

import type { AuthRouteScope } from "./auth.dto";

describe("Auth DTO", () => {
  it("supports route scope union", () => {
    const scope: AuthRouteScope = "session";
    expect(scope).toBe("session");
  });
});
