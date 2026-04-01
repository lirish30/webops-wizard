import type { ConnectorModule, ConnectorProvider } from "./connector.types";

export interface ConnectorRegistry {
  get(provider: ConnectorProvider): ConnectorModule;
  list(): ConnectorModule[];
}

export function createConnectorRegistry(connectors: ConnectorModule[]): ConnectorRegistry {
  const byProvider = new Map<ConnectorProvider, ConnectorModule>();

  for (const connector of connectors) {
    byProvider.set(connector.provider, connector);
  }

  return {
    get(provider) {
      const connector = byProvider.get(provider);
      if (!connector) {
        throw new Error(`No connector registered for provider=${provider}`);
      }

      return connector;
    },
    list() {
      return [...byProvider.values()];
    }
  };
}
