import type { QueueContract } from "@webops-wizard/types";

import type {
  ConnectorConnectionContext,
  ConnectorProvider,
  SyncTrigger
} from "../connectors/connector.types";

export interface ConnectorSyncJobPayload {
  integrationConnectionId: string;
  trigger: SyncTrigger;
}

export interface SchedulableConnection
  extends Pick<
    ConnectorConnectionContext,
    "id" | "provider" | "configJson"
  > {
  lastSyncedAt: Date | null;
}

const DEFAULT_SYNC_CADENCE_MINUTES = 6 * 60;

function readCadenceMinutes(
  provider: ConnectorProvider,
  configJson: Record<string, unknown> | null
): number {
  const config = configJson ?? {};
  const connectorSchedule = config.connectorSchedule;

  if (
    typeof connectorSchedule === "object" &&
    connectorSchedule !== null &&
    "everyMinutes" in connectorSchedule &&
    typeof connectorSchedule.everyMinutes === "number" &&
    connectorSchedule.everyMinutes > 0
  ) {
    return Math.floor(connectorSchedule.everyMinutes);
  }

  if (provider === "ga4") {
    return DEFAULT_SYNC_CADENCE_MINUTES;
  }

  return DEFAULT_SYNC_CADENCE_MINUTES;
}

export function buildDueSyncJobs(
  connections: SchedulableConnection[],
  now: Date
): QueueContract<ConnectorSyncJobPayload>[] {
  return connections
    .filter((connection) => {
      const cadenceMinutes = readCadenceMinutes(connection.provider, connection.configJson);

      if (!connection.lastSyncedAt) {
        return true;
      }

      const elapsedMs = now.getTime() - connection.lastSyncedAt.getTime();
      return elapsedMs >= cadenceMinutes * 60 * 1000;
    })
    .map((connection) => ({
      name: "connector-sync",
      version: 1,
      payload: {
        integrationConnectionId: connection.id,
        trigger: "schedule"
      }
    }));
}
