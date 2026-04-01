import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class PropertiesService {
  async listProperties(workspaceId: string) {
    return prisma.property.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }]
    });
  }
}
