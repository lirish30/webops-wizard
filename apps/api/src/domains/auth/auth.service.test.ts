import { describe, expect, it } from "vitest";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("constructs", () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/webops_wizard";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.JWT_SECRET ??= "test-secret-value";
    const service = new AuthService({} as never);
    expect(service).toBeInstanceOf(AuthService);
  });
});
