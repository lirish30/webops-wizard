import type { ConnectorProvider } from "../connectors/connector.types";

export interface ConnectorCredentialRecord {
  reference: string;
  workspaceId: string;
  provider: ConnectorProvider;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CredentialStore {
  get(reference: string): Promise<ConnectorCredentialRecord | null>;
  put(record: ConnectorCredentialRecord): Promise<void>;
  rotate(reference: string, payload: Record<string, unknown>): Promise<void>;
}
