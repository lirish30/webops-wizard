import { prisma } from "@webops-wizard/db";

import { createConnectorRegistry } from "../connectors/connector.registry";
import { createCrawlerConnector } from "../connectors/crawler/crawler.connector";
import { createGa4Connector } from "../connectors/ga4/ga4.connector";
import { createGscConnector } from "../connectors/gsc/gsc.connector";
import { createSitemapConnector } from "../connectors/sitemap/sitemap.connector";
import type { SyncTrigger } from "../connectors/connector.types";
import { DbCredentialStore } from "../credentials/db-credential-store";
import { buildDueSyncJobs } from "./scheduler";
import { PrismaSyncPersistence } from "./prisma-sync-persistence";
import { runConnectorSync } from "./sync-runner";

const registry = createConnectorRegistry([
  createGa4Connector(),
  createGscConnector(),
  createSitemapConnector(),
  createCrawlerConnector()
]);

export class ConnectorSyncService {
  async runForConnection(input: {
    integrationConnectionId: string;
    trigger: SyncTrigger;
    idempotencyRunId?: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: input.integrationConnectionId }
    });

    if (!connection) {
      throw new Error(`Integration connection not found: ${input.integrationConnectionId}`);
    }

    const connector = registry.get(connection.provider);
    const persistence = new PrismaSyncPersistence({
      id: connection.id,
      workspaceId: connection.workspaceId,
      propertyId: connection.propertyId,
      provider: connection.provider,
      credentialRef: connection.credentialRef,
      freshnessSlaMinutes: connection.freshnessSlaMinute,
      configJson:
        connection.configJson && typeof connection.configJson === "object"
          ? (connection.configJson as Record<string, unknown>)
          : null
    });

    const credentialStore = new DbCredentialStore();

    return runConnectorSync({
      connection: {
        id: connection.id,
        workspaceId: connection.workspaceId,
        propertyId: connection.propertyId,
        provider: connection.provider,
        credentialRef: connection.credentialRef,
        freshnessSlaMinutes: connection.freshnessSlaMinute,
        configJson:
          connection.configJson && typeof connection.configJson === "object"
            ? (connection.configJson as Record<string, unknown>)
            : null
      },
      trigger: input.trigger,
      now,
      ...(input.idempotencyRunId ? { runId: input.idempotencyRunId } : {}),
      connector,
      credentialStore,
      persistence
    });
  }

  async buildScheduledJobs(now = new Date()) {
    const connections = await prisma.integrationConnection.findMany({
      where: {
        provider: {
          in: ["ga4", "gsc", "sitemap", "crawler"]
        },
        status: {
          not: "disconnected"
        }
      },
      select: {
        id: true,
        provider: true,
        configJson: true,
        lastSyncedAt: true
      }
    });

    return buildDueSyncJobs(
      connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        configJson:
          connection.configJson && typeof connection.configJson === "object"
            ? (connection.configJson as Record<string, unknown>)
            : null,
        lastSyncedAt: connection.lastSyncedAt
      })),
      now
    );
  }
}
