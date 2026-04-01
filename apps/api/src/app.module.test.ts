import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";

describe("AppModule", () => {
  it("compiles the modular monolith root module", async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/webops_wizard";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.JWT_SECRET ??= "test-secret-value";

    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    expect(testingModule).toBeDefined();
  });
});
