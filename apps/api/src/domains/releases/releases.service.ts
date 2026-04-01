import { Injectable } from "@nestjs/common";
import { prisma } from "@webops-wizard/db";

@Injectable()
export class ReleasesService {
  async listReleases(workspaceId: string) {
    return prisma.releaseAnnotation.findMany({
      where: {
        property: {
          workspaceId
        }
      },
      orderBy: [{ startedAt: "desc" }]
    });
  }
}
