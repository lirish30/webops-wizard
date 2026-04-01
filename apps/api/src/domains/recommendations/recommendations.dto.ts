import { RecommendationDomain, RecommendationStatus } from "@prisma/client";
import { z } from "zod";

export const listRecommendationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  status: z.nativeEnum(RecommendationStatus).optional(),
  domain: z.nativeEnum(RecommendationDomain).optional()
});

export const generateRecommendationSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  category: z.string().min(1).max(120).optional()
});

export type ListRecommendationsQueryDto = z.infer<typeof listRecommendationsQuerySchema>;
export type GenerateRecommendationDto = z.infer<typeof generateRecommendationSchema>;
