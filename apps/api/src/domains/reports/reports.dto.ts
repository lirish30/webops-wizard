import { z } from "zod";

export const sendReportSchema = z.object({
  reportName: z.string().min(1).max(200),
  recipients: z.array(z.string().email()).default([])
});

export type SendReportDto = z.infer<typeof sendReportSchema>;
