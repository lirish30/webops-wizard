import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class PagesService {
  async getOverview(workspaceId: string) {
    const propertyCount = await prisma.property.count({
      where: { workspaceId }
    });

    return {
      workspaceId,
      status: "ready" as const,
      propertyCount
    };
  }
}
