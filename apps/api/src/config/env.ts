import { nodeEnvSchema, parseEnv } from "@webops-wizard/config";
import { z } from "zod";

export const apiEnvSchema = nodeEnvSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(8)
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function getApiEnv(input?: Record<string, string | undefined>): ApiEnv {
  return parseEnv(apiEnvSchema, input);
}
