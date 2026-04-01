import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class DataTrustService {
  async getSummary(workspaceId: string) {
    const [propertyCount, integrationCount] = await Promise.all([
      prisma.property.count({ where: { workspaceId } }),
      prisma.integrationConnection.count({ where: { workspaceId } })
    ]);

    return {
      workspaceId,
      status: "healthy" as const,
      signals: {
        propertyCount,
        integrationCount
      }
    };
  }
}
