import { nodeEnvSchema, parseEnv } from "@webops-wizard/config";
import { z } from "zod";

export const apiEnvSchema = nodeEnvSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(8),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1209600),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  INVITE_TTL_SECONDS: z.coerce.number().int().positive().default(604800)
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function getApiEnv(input?: Record<string, string | undefined>): ApiEnv {
  return parseEnv(apiEnvSchema, input);
}
