import type {
  ConnectorCredentialRecord,
  CredentialStore
} from "./credential-store";

export class InMemoryCredentialStore implements CredentialStore {
  private readonly records = new Map<string, ConnectorCredentialRecord>();

  async get(reference: string): Promise<ConnectorCredentialRecord | null> {
    return this.records.get(reference) ?? null;
  }

  async put(record: ConnectorCredentialRecord): Promise<void> {
    this.records.set(record.reference, record);
  }

  async rotate(reference: string, payload: Record<string, unknown>): Promise<void> {
    const existing = this.records.get(reference);

    if (!existing) {
      throw new Error(`Credential reference not found: ${reference}`);
    }

    this.records.set(reference, {
      ...existing,
      payload
    });
  }
}
