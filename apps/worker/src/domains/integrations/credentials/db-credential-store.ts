import { Prisma } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

import type {
  ConnectorCredentialRecord,
  CredentialStore
} from "./credential-store";

function toInputJson(value: object): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toRecord(row: {
  reference: string;
  workspaceId: string;
  provider: ConnectorCredentialRecord["provider"];
  payloadJson: unknown;
  metadataJson: unknown;
}): ConnectorCredentialRecord {
  return {
    reference: row.reference,
    workspaceId: row.workspaceId,
    provider: row.provider,
    payload: (row.payloadJson as Record<string, unknown>) ?? {},
    ...((row.metadataJson as Record<string, unknown> | null)
      ? { metadata: row.metadataJson as Record<string, unknown> }
      : {})
  };
}

export class DbCredentialStore implements CredentialStore {
  async get(reference: string): Promise<ConnectorCredentialRecord | null> {
    const row = await prisma.connectorCredential.findUnique({
      where: { reference }
    });

    if (!row) {
      return null;
    }

    return toRecord(row);
  }

  async put(record: ConnectorCredentialRecord): Promise<void> {
    await prisma.connectorCredential.upsert({
      where: { reference: record.reference },
      update: {
        payloadJson: toInputJson(record.payload),
        metadataJson: record.metadata ? toInputJson(record.metadata) : Prisma.JsonNull
      },
      create: {
        reference: record.reference,
        workspaceId: record.workspaceId,
        provider: record.provider,
        payloadJson: toInputJson(record.payload),
        metadataJson: record.metadata ? toInputJson(record.metadata) : Prisma.JsonNull
      }
    });
  }

  async rotate(reference: string, payload: Record<string, unknown>): Promise<void> {
    await prisma.connectorCredential.update({
      where: { reference },
      data: {
        payloadJson: toInputJson(payload)
      }
    });
  }
}
