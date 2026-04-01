import type {
  ConnectorModule,
  ConnectorSyncResult,
  OAuthRefreshResult
} from "../connector.types";

import { ConnectorExecutionError } from "../../sync/retry";

const GA4_SEGMENTS = ["sessions", "events", "conversions"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildRefreshedToken(now: Date): OAuthRefreshResult {
  return {
    accessToken: `ga4-token-${now.getTime()}`,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  };
}

export function createGa4Connector(): ConnectorModule {
  return {
    provider: "ga4",
    oauth: {
      async refreshAccessToken({ credentialReference, credentialStore, now }) {
        const credential = await credentialStore.get(credentialReference);

        if (!credential) {
          throw new ConnectorExecutionError("Missing GA4 credential", {
            code: "MISSING_CREDENTIAL",
            retryable: false
          });
        }

        const refreshToken = credential.payload.refreshToken;
        if (typeof refreshToken !== "string" || refreshToken.length === 0) {
          throw new ConnectorExecutionError("Missing GA4 refresh token", {
            code: "MISSING_REFRESH_TOKEN",
            retryable: false
          });
        }

        const refreshed = buildRefreshedToken(now);

        await credentialStore.rotate(credentialReference, {
          ...credential.payload,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          refreshToken
        });

        return refreshed;
      }
    },
    async sync({ connection, now }) {
      const config = isRecord(connection.configJson) ? connection.configJson : {};
      const failedSegmentsRaw = config.simulatedFailureSegments;
      const failedSegments = Array.isArray(failedSegmentsRaw)
        ? failedSegmentsRaw.filter((value): value is string => typeof value === "string")
        : [];

      const segments: ConnectorSyncResult["segments"] = GA4_SEGMENTS.map((segment) => {
        if (failedSegments.includes(segment)) {
          return {
            segment,
            status: "failed",
            retryable: true,
            code: "SEGMENT_TIMEOUT",
            message: `${segment} stream timed out`
          };
        }

        return {
          segment,
          status: "success",
          recordsSynced: 100
        };
      });

      return {
        fetchedAt: now,
        latestDataAt: now,
        segments
      };
    }
  };
}
