import { describe, expect, it } from "vitest";
import { z } from "zod";

import { nodeEnvSchema, parseEnv } from "./env";

describe("parseEnv", () => {
  it("parses a valid env payload", () => {
    const env = parseEnv(nodeEnvSchema, {
      DATABASE_URL: "postgresql://localhost:5432/webops",
      LOG_LEVEL: "debug",
      NODE_ENV: "development",
      REDIS_URL: "redis://localhost:6379"
    });

    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when required values are missing", () => {
    expect(() =>
      parseEnv(z.object({ REQUIRED_VALUE: z.string().min(1) }), {})
    ).toThrow();
  });
});
