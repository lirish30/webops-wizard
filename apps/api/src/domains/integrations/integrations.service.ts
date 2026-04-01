import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "@webops-wizard/db";
import {
  createPlaceholderGa4Provider,
  createPlaceholderGscProvider
} from "../../../../../packages/integrations/src/index";

import { buildLastSyncHealth } from "./integrations.health";

@Injectable()
export class IntegrationsService {
  private readonly ga4Provider = createPlaceholderGa4Provider();
  private readonly gscProvider = createPlaceholderGscProvider();

  mergeConnectorConfig(
    current: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>
  ): Record<string, unknown> {
    const next = { ...(current ?? {}) };

    for (const [key, value] of Object.entries(patch)) {
      if (isRecord(value) && isRecord(next[key])) {
        next[key] = { ...(next[key] as Record<string, unknown>), ...value };
        continue;
      }

      next[key] = value;
    }

    return next;
  }

  mergeGa4Config(
    current: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>
  ): Record<string, unknown> {
    return this.mergeConnectorConfig(current, patch);
  }

  private async getWorkspaceIntegrationOrThrow(
    workspaceId: string,
    integrationId: string
  ) {
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        id: integrationId,
        workspaceId
      },
      include: {
        syncRuns: {
          take: 1,
          orderBy: [{ startedAt: "desc" }]
        }
      }
    });

    if (!connection) {
      throw new NotFoundException("Integration not found in workspace.");
    }

    return connection;
  }

  async listIntegrations(workspaceId: string) {
    const rows = await prisma.integrationConnection.findMany({
      where: { workspaceId },
      include: {
        syncRuns: {
          take: 1,
          orderBy: [{ startedAt: "desc" }]
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => {
      const { syncRuns, ...connection } = row;

      return {
        ...connection,
        lastSyncHealth: buildLastSyncHealth({
          lastSuccessAt: row.lastSuccessAt,
          lastErrorAt: row.lastErrorAt,
          lastErrorMessage: row.lastErrorMessage,
          latestRun: syncRuns[0]
            ? {
                startedAt: syncRuns[0].startedAt,
                status: syncRuns[0].status,
                partialFailure: syncRuns[0].partialFailure,
                freshnessMetadataJson: syncRuns[0].freshnessMetadataJson,
                coverageMetadataJson: syncRuns[0].coverageMetadataJson
              }
            : null
        })
      };
    });
  }

  async updateIntegration(input: {
    integrationId: string;
    workspaceId: string;
    body: { status?: "connected" | "warning" | "error" | "syncing"; configJson?: unknown };
  }) {
    const data: Parameters<typeof prisma.integrationConnection.updateMany>[0]["data"] = {
      ...(input.body.status ? { status: input.body.status } : {}),
      ...(input.body.configJson !== undefined
        ? { configJson: input.body.configJson as never }
        : {})
    };

    const updateResult = await prisma.integrationConnection.updateMany({
      where: {
        id: input.integrationId,
        workspaceId: input.workspaceId
      },
      data
    });

    if (updateResult.count === 0) {
      throw new NotFoundException("Integration not found in workspace.");
    }

    return prisma.integrationConnection.findUnique({
      where: { id: input.integrationId }
    });
  }

  async getGa4Status(workspaceId: string, integrationId: string) {
    const connection = await this.getWorkspaceIntegrationOrThrow(workspaceId, integrationId);
    const config = (connection.configJson as Record<string, unknown> | null) ?? {};

    return {
      integrationId: connection.id,
      provider: connection.provider,
      connectionStatus: connection.status,
      auth: (config.oauth as Record<string, unknown> | null) ?? {
        status: "not_started"
      },
      selectedProperty: (config.selectedProperty as Record<string, unknown> | null) ?? null,
      availableProperties:
        (config.availableProperties as Array<Record<string, unknown>> | null) ?? [],
      pendingBackfill: (config.pendingBackfill as Record<string, unknown> | null) ?? null,
      lastSyncHealth: buildLastSyncHealth({
        lastSuccessAt: connection.lastSuccessAt,
        lastErrorAt: connection.lastErrorAt,
        lastErrorMessage: connection.lastErrorMessage,
        latestRun: connection.syncRuns[0]
          ? {
              startedAt: connection.syncRuns[0].startedAt,
              status: connection.syncRuns[0].status,
              partialFailure: connection.syncRuns[0].partialFailure,
              freshnessMetadataJson: connection.syncRuns[0].freshnessMetadataJson,
              coverageMetadataJson: connection.syncRuns[0].coverageMetadataJson
            }
          : null
      })
    };
  }

  async startGa4OAuth(input: {
    workspaceId: string;
    integrationId: string;
    redirectUri: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const started = await this.ga4Provider.startOAuth({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      redirectUri: input.redirectUri
    });

    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        oauth: {
          status: "pending",
          state: started.state,
          redirectUri: input.redirectUri,
          initiatedAt: new Date().toISOString()
        }
      }
    );

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: "syncing",
        configJson: toInputJson(config)
      }
    });

    return started;
  }

  async completeGa4OAuth(input: {
    workspaceId: string;
    integrationId: string;
    code: string;
    state: string;
    redirectUri: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const completed = await this.ga4Provider.completeOAuth({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      code: input.code,
      state: input.state,
      redirectUri: input.redirectUri
    });
    const credentialRef = connection.credentialRef ?? `ga4:${connection.id}`;

    await prisma.connectorCredential.upsert({
      where: { reference: credentialRef },
      update: {
        payloadJson: completed.credentialPayload as never,
        metadataJson: {
          account: completed.account
        } as never
      },
      create: {
        reference: credentialRef,
        workspaceId: connection.workspaceId,
        provider: "ga4",
        payloadJson: completed.credentialPayload as never,
        metadataJson: {
          account: completed.account
        } as never
      }
    });

    const properties = await this.ga4Provider.listProperties({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      accessToken: completed.credentialPayload.accessToken
    });

    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        oauth: {
          status: "connected",
          connectedAt: new Date().toISOString(),
          state: input.state,
          account: completed.account
        },
        availableProperties: properties
      }
    );

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        credentialRef,
        status: "warning",
        configJson: toInputJson(config)
      }
    });

    return {
      credentialRef,
      account: completed.account,
      properties
    };
  }

  async listGa4Properties(workspaceId: string, integrationId: string) {
    const connection = await this.getWorkspaceIntegrationOrThrow(workspaceId, integrationId);
    const config = (connection.configJson as Record<string, unknown> | null) ?? {};

    return (config.availableProperties as Array<Record<string, unknown>> | null) ?? [];
  }

  async selectGa4Property(input: {
    workspaceId: string;
    integrationId: string;
    propertyId: string;
    displayName: string;
    syncEveryMinutes?: number;
    freshnessSlaMinutes?: number;
    lookbackDays?: number;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        selectedProperty: {
          propertyId: input.propertyId,
          displayName: input.displayName
        },
        ...(input.syncEveryMinutes
          ? {
              connectorSchedule: {
                everyMinutes: input.syncEveryMinutes
              }
            }
          : {}),
        ...(input.lookbackDays ? { lookbackDays: input.lookbackDays } : {})
      }
    );

    return prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: "connected",
        freshnessSlaMinute: input.freshnessSlaMinutes ?? connection.freshnessSlaMinute,
        configJson: toInputJson(config)
      }
    });
  }

  async requestGa4Backfill(input: {
    workspaceId: string;
    integrationId: string;
    startDate: string;
    endDate: string;
    requestedByUserId: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        pendingBackfill: {
          startDate: input.startDate,
          endDate: input.endDate,
          requestedAt: new Date().toISOString(),
          requestedByUserId: input.requestedByUserId
        }
      }
    );

    return prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        configJson: toInputJson(config),
        status: "syncing"
      }
    });
  }

  async getGscStatus(workspaceId: string, integrationId: string) {
    const connection = await this.getWorkspaceIntegrationOrThrow(workspaceId, integrationId);
    const config = (connection.configJson as Record<string, unknown> | null) ?? {};
    const availableSites = await prisma.searchConsoleSite.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: [{ selected: "desc" }, { displayName: "asc" }]
    });

    return {
      integrationId: connection.id,
      provider: connection.provider,
      connectionStatus: connection.status,
      auth: (config.oauth as Record<string, unknown> | null) ?? {
        status: "not_started"
      },
      selectedSite: (config.selectedSite as Record<string, unknown> | null) ?? null,
      availableSites: availableSites.map((site) => ({
        siteUrl: site.siteUrl,
        displayName: site.displayName,
        permissionLevel: site.permissionLevel,
        selected: site.selected
      })),
      pendingBackfill: (config.pendingBackfill as Record<string, unknown> | null) ?? null,
      lastSyncHealth: buildLastSyncHealth({
        lastSuccessAt: connection.lastSuccessAt,
        lastErrorAt: connection.lastErrorAt,
        lastErrorMessage: connection.lastErrorMessage,
        latestRun: connection.syncRuns[0]
          ? {
              startedAt: connection.syncRuns[0].startedAt,
              status: connection.syncRuns[0].status,
              partialFailure: connection.syncRuns[0].partialFailure,
              freshnessMetadataJson: connection.syncRuns[0].freshnessMetadataJson,
              coverageMetadataJson: connection.syncRuns[0].coverageMetadataJson
            }
          : null
      })
    };
  }

  async startGscOAuth(input: {
    workspaceId: string;
    integrationId: string;
    redirectUri: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const started = await this.gscProvider.startOAuth({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      redirectUri: input.redirectUri
    });

    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        oauth: {
          status: "pending",
          state: started.state,
          redirectUri: input.redirectUri,
          initiatedAt: new Date().toISOString()
        }
      }
    );

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: "syncing",
        configJson: toInputJson(config)
      }
    });

    return started;
  }

  async completeGscOAuth(input: {
    workspaceId: string;
    integrationId: string;
    code: string;
    state: string;
    redirectUri: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const completed = await this.gscProvider.completeOAuth({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      code: input.code,
      state: input.state,
      redirectUri: input.redirectUri
    });
    const credentialRef = connection.credentialRef ?? `gsc:${connection.id}`;

    await prisma.connectorCredential.upsert({
      where: { reference: credentialRef },
      update: {
        payloadJson: completed.credentialPayload as never,
        metadataJson: {
          account: completed.account
        } as never
      },
      create: {
        reference: credentialRef,
        workspaceId: connection.workspaceId,
        provider: "gsc",
        payloadJson: completed.credentialPayload as never,
        metadataJson: {
          account: completed.account
        } as never
      }
    });

    const sites = await this.gscProvider.listSites({
      workspaceId: input.workspaceId,
      integrationConnectionId: connection.id,
      accessToken: completed.credentialPayload.accessToken
    });

    await prisma.$transaction([
      prisma.searchConsoleSite.deleteMany({
        where: { integrationConnectionId: connection.id }
      }),
      prisma.searchConsoleSite.createMany({
        data: sites.map((site) => ({
          integrationConnectionId: connection.id,
          workspaceId: connection.workspaceId,
          siteUrl: site.siteUrl,
          displayName: site.displayName,
          selected: false
        }))
      })
    ]);

    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        oauth: {
          status: "connected",
          connectedAt: new Date().toISOString(),
          state: input.state,
          account: completed.account
        },
        availableSites: sites
      }
    );

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        credentialRef,
        status: "warning",
        configJson: toInputJson(config)
      }
    });

    return {
      credentialRef,
      account: completed.account,
      sites
    };
  }

  async listGscSites(workspaceId: string, integrationId: string) {
    const connection = await this.getWorkspaceIntegrationOrThrow(workspaceId, integrationId);

    const sites = await prisma.searchConsoleSite.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: [{ selected: "desc" }, { displayName: "asc" }]
    });

    return sites.map((site) => ({
      siteUrl: site.siteUrl,
      displayName: site.displayName,
      permissionLevel: site.permissionLevel,
      selected: site.selected
    }));
  }

  async selectGscSite(input: {
    workspaceId: string;
    integrationId: string;
    siteUrl: string;
    displayName: string;
    syncEveryMinutes?: number;
    freshnessSlaMinutes?: number;
    lookbackDays?: number;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        selectedSite: {
          siteUrl: input.siteUrl,
          displayName: input.displayName
        },
        ...(input.syncEveryMinutes
          ? {
              connectorSchedule: {
                everyMinutes: input.syncEveryMinutes
              }
            }
          : {}),
        ...(input.lookbackDays ? { lookbackDays: input.lookbackDays } : {})
      }
    );

    return prisma.$transaction(async (tx) => {
      await tx.searchConsoleSite.updateMany({
        where: { integrationConnectionId: connection.id },
        data: { selected: false }
      });

      await tx.searchConsoleSite.upsert({
        where: {
          integrationConnectionId_siteUrl: {
            integrationConnectionId: connection.id,
            siteUrl: input.siteUrl
          }
        },
        update: {
          displayName: input.displayName,
          selected: true
        },
        create: {
          integrationConnectionId: connection.id,
          workspaceId: connection.workspaceId,
          siteUrl: input.siteUrl,
          displayName: input.displayName,
          selected: true
        }
      });

      return tx.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          freshnessSlaMinute: input.freshnessSlaMinutes ?? connection.freshnessSlaMinute,
          configJson: toInputJson(config)
        }
      });
    });
  }

  async requestGscBackfill(input: {
    workspaceId: string;
    integrationId: string;
    startDate: string;
    endDate: string;
    requestedByUserId: string;
  }) {
    const connection = await this.getWorkspaceIntegrationOrThrow(
      input.workspaceId,
      input.integrationId
    );
    const config = this.mergeConnectorConfig(
      (connection.configJson as Record<string, unknown> | null) ?? {},
      {
        pendingBackfill: {
          startDate: input.startDate,
          endDate: input.endDate,
          requestedAt: new Date().toISOString(),
          requestedByUserId: input.requestedByUserId
        }
      }
    );

    return prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        configJson: toInputJson(config),
        status: "syncing"
      }
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
