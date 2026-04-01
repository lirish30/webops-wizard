import { z } from "zod";

export const updateIntegrationSchema = z.object({
  status: z.enum(["connected", "warning", "error", "syncing"]).optional(),
  configJson: z.unknown().optional()
});

export type UpdateIntegrationDto = z.infer<typeof updateIntegrationSchema>;
