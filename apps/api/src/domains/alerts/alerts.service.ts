import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class AlertsService {
  async listAlerts(workspaceId: string) {
    return prisma.alert.findMany({
      where: {
        property: {
          workspaceId
        }
      },
      orderBy: [{ triggeredAt: "desc" }]
    });
  }
}
