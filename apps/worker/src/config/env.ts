import { nodeEnvSchema, parseEnv } from "@webops-wizard/config";
import { z } from "zod";

export const workerEnvSchema = nodeEnvSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function getWorkerEnv(
  input?: Record<string, string | undefined>
): WorkerEnv {
  return parseEnv(workerEnvSchema, input);
}
