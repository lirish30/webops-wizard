import { z } from "zod";

export const updateIntegrationSchema = z.object({
  status: z.enum(["connected", "warning", "error", "syncing"]).optional(),
  configJson: z.unknown().optional()
});

export const startGa4OAuthSchema = z.object({
  redirectUri: z.string().url()
});

export const completeGa4OAuthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url()
});

export const selectGa4PropertySchema = z.object({
  propertyId: z.string().min(1),
  displayName: z.string().min(1),
  syncEveryMinutes: z.number().int().min(15).max(7 * 24 * 60).optional(),
  freshnessSlaMinutes: z.number().int().min(15).max(14 * 24 * 60).optional(),
  lookbackDays: z.number().int().min(1).max(30).optional()
});

export const requestGa4BackfillSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"]
  });

export const startGscOAuthSchema = z.object({
  redirectUri: z.string().url()
});

export const completeGscOAuthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url()
});

export const selectGscSiteSchema = z.object({
  siteUrl: z.string().min(1),
  displayName: z.string().min(1),
  syncEveryMinutes: z.number().int().min(15).max(7 * 24 * 60).optional(),
  freshnessSlaMinutes: z.number().int().min(15).max(14 * 24 * 60).optional(),
  lookbackDays: z.number().int().min(1).max(30).optional()
});

export const requestGscBackfillSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"]
  });

export type UpdateIntegrationDto = z.infer<typeof updateIntegrationSchema>;
export type StartGa4OAuthDto = z.infer<typeof startGa4OAuthSchema>;
export type CompleteGa4OAuthDto = z.infer<typeof completeGa4OAuthSchema>;
export type SelectGa4PropertyDto = z.infer<typeof selectGa4PropertySchema>;
export type RequestGa4BackfillDto = z.infer<typeof requestGa4BackfillSchema>;
export type StartGscOAuthDto = z.infer<typeof startGscOAuthSchema>;
export type CompleteGscOAuthDto = z.infer<typeof completeGscOAuthSchema>;
export type SelectGscSiteDto = z.infer<typeof selectGscSiteSchema>;
export type RequestGscBackfillDto = z.infer<typeof requestGscBackfillSchema>;
