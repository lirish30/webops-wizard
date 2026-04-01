import { createGa4Connector } from "./connectors/ga4/ga4.connector";
import { createConnectorRegistry } from "./connectors/connector.registry";

export const integrationsWorkerDomain = "integrations";

export const connectorRegistry = createConnectorRegistry([createGa4Connector()]);

export * from "./connectors/connector.types";
export * from "./credentials/credential-store";
export * from "./credentials/in-memory-credential-store";
export * from "./credentials/db-credential-store";
export * from "./sync/retry";
export * from "./sync/scheduler";
export * from "./sync/sync-runner";
export * from "./sync/prisma-sync-persistence";
export * from "./sync/connector-sync.service";
