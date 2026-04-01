import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class ReportsService {
  async getReportSummary(workspaceId: string) {
    const [recommendationCount, alertCount, releaseCount] = await Promise.all([
      prisma.recommendation.count({
        where: { property: { workspaceId } }
      }),
      prisma.alert.count({
        where: { property: { workspaceId } }
      }),
      prisma.releaseAnnotation.count({
        where: { property: { workspaceId } }
      })
    ]);

    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      summary: {
        recommendationCount,
        alertCount,
        releaseCount
      }
    };
  }
}
