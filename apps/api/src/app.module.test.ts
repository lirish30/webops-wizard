import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";

describe("AppModule", () => {
  it("compiles the modular monolith root module", async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    expect(testingModule).toBeDefined();
  });
});
