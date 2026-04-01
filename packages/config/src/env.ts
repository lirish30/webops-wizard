import { z } from "zod";

export function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: Record<string, string | undefined> = process.env
): z.infer<TSchema> {
  return schema.parse(input) as z.infer<TSchema>;
}

export const nodeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1)
});
