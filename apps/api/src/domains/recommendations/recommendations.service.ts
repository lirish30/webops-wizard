import { Injectable, NotFoundException } from "@nestjs/common";
import { RecommendationDomain, RecommendationStatus } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

import {
  buildPaginationMeta,
  parseFilters,
  parsePagination,
  parseSort
} from "../../common/api/query-helpers";

@Injectable()
export class RecommendationsService {
  async listRecommendations(workspaceId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query, { defaultPageSize: 25, maxPageSize: 100 });
    const sort = parseSort(query, {
      defaultSort: { field: "createdAt", direction: "desc" },
      allowedFields: ["createdAt", "updatedAt", "impactScore", "title"] as const
    });
    const filters = parseFilters(query, ["status", "domain"] as const);

    const statusFilter =
      filters.status &&
      Object.values(RecommendationStatus).includes(filters.status as RecommendationStatus)
        ? (filters.status as RecommendationStatus)
        : undefined;
    const domainFilter =
      filters.domain &&
      Object.values(RecommendationDomain).includes(filters.domain as RecommendationDomain)
        ? (filters.domain as RecommendationDomain)
        : undefined;

    const where = {
      property: {
        workspaceId
      },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(domainFilter ? { domain: domainFilter } : {})
    };

    const [items, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        orderBy: [{ [sort.field]: sort.direction }],
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.recommendation.count({ where })
    ]);

    return {
      workspaceId,
      items,
      pagination: buildPaginationMeta(pagination, total)
    };
  }

  async generateRecommendation(input: {
    workspaceId: string;
    title?: string;
    category?: string;
  }) {
    const property = await prisma.property.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: [{ createdAt: "asc" }]
    });
    if (!property) {
      throw new NotFoundException("Create a property before generating recommendations.");
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        propertyId: property.id,
        relatedScopeId: property.id,
        title: input.title?.trim() || "AI generated recommendation",
        category: input.category?.trim() || "technical",
        status: "new"
      }
    });

    return {
      recommendation,
      propertyId: property.id
    };
  }

  async approveRecommendation(input: {
    workspaceId: string;
    recommendationId: string;
  }) {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        property: {
          workspaceId: input.workspaceId
        }
      }
    });
    if (!recommendation) {
      throw new NotFoundException("Recommendation not found in workspace.");
    }

    const approved = await prisma.recommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "accepted",
        approvalState: "approved"
      }
    });

    return {
      approved,
      previousStatus: recommendation.status
    };
  }
}
