import { prisma } from "@webops-wizard/db";
import {
  createPlaceholderGscProvider,
  type GscDailyQueryMetric,
  type GscProvider
} from "../../../../../../../packages/integrations/src/index";

import type {
  ConnectorModule,
  ConnectorSyncResult,
  OAuthRefreshResult
} from "../connector.types";
import { ConnectorExecutionError } from "../../sync/retry";

interface GscSelectedSite {
  siteUrl: string;
  displayName?: string;
}

interface GscBackfillRequest {
  startDate: string;
  endDate: string;
  requestedAt?: string;
  requestedByUserId?: string;
}

interface GscConfig {
  oauth?: Record<string, unknown>;
  selectedSite?: GscSelectedSite;
  availableSites?: Array<Record<string, unknown>>;
  pendingBackfill?: GscBackfillRequest | null;
  connectorSchedule?: {
    everyMinutes: number;
  };
  lookbackDays?: number;
}

export interface SearchConsoleMetricsStore {
  ingest(input: {
    propertyId: string;
    rows: GscDailyQueryMetric[];
  }): Promise<{
    pageRecordsSynced: number;
    queryRecordsSynced: number;
    unresolvedPageUrls: string[];
  }>;
}

function normalizeUrlKey(urlString: string): string {
  const parsed = new URL(urlString);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${pathname}`.toLowerCase() || parsed.hostname.toLowerCase();
}

function parseGscConfig(configJson: Record<string, unknown> | null): GscConfig {
  if (!configJson) {
    return {};
  }

  return configJson as GscConfig;
}

function buildRefreshedToken(now: Date): OAuthRefreshResult {
  return {
    accessToken: `gsc-token-${now.getTime()}`,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  };
}

function readDateWindow(config: GscConfig, now: Date) {
  if (config.pendingBackfill) {
    return config.pendingBackfill;
  }

  const lookbackDays = Math.max(1, Math.floor(config.lookbackDays ?? 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(end.getTime() - (lookbackDays - 1) * 24 * 60 * 60 * 1000);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function parseIsoDay(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

class PrismaSearchConsoleMetricsStore implements SearchConsoleMetricsStore {
  async ingest(input: {
    propertyId: string;
    rows: GscDailyQueryMetric[];
  }): Promise<{
    pageRecordsSynced: number;
    queryRecordsSynced: number;
    unresolvedPageUrls: string[];
  }> {
    if (input.rows.length === 0) {
      return {
        pageRecordsSynced: 0,
        queryRecordsSynced: 0,
        unresolvedPageUrls: []
      };
    }

    const urlKeys = [...new Set(input.rows.map((row) => normalizeUrlKey(row.pageUrl)))];
    const [canonicalPages, urlRecords] = await Promise.all([
      prisma.canonicalPage.findMany({
        where: {
          propertyId: input.propertyId,
          normalizedUrlKey: { in: urlKeys }
        },
        select: {
          id: true,
          normalizedUrlKey: true
        }
      }),
      prisma.urlRecord.findMany({
        where: {
          propertyId: input.propertyId,
          normalizedUrlKey: { in: urlKeys }
        },
        select: {
          canonicalPageId: true,
          normalizedUrlKey: true
        }
      })
    ]);

    const canonicalByKey = new Map(
      canonicalPages.map((page) => [page.normalizedUrlKey, page.id])
    );

    for (const urlRecord of urlRecords) {
      canonicalByKey.set(urlRecord.normalizedUrlKey, urlRecord.canonicalPageId);
    }

    const unresolvedPageUrls = new Set<string>();
    const pageRollups = new Map<
      string,
      {
        canonicalPageId: string;
        date: string;
        clicks: number;
        impressions: number;
        weightedPosition: number;
      }
    >();
    let queryRecordsSynced = 0;

    for (const row of input.rows) {
      const canonicalPageId = canonicalByKey.get(normalizeUrlKey(row.pageUrl));
      if (!canonicalPageId) {
        unresolvedPageUrls.add(row.pageUrl);
        continue;
      }

      const impressions = row.impressions ?? 0;
      const clicks = row.clicks ?? 0;
      const avgPosition = row.avgPosition ?? 0;

      await prisma.queryMetricDaily.upsert({
        where: {
          propertyId_canonicalPageId_queryText_date: {
            propertyId: input.propertyId,
            canonicalPageId,
            queryText: row.query,
            date: new Date(`${row.date}T00:00:00.000Z`)
          }
        },
        update: {
          clicks: row.clicks ?? null,
          impressions: row.impressions ?? null,
          ctr: row.ctr ?? null,
          avgPosition: row.avgPosition ?? null
        },
        create: {
          propertyId: input.propertyId,
          canonicalPageId,
          queryText: row.query,
          date: new Date(`${row.date}T00:00:00.000Z`),
          clicks: row.clicks ?? null,
          impressions: row.impressions ?? null,
          ctr: row.ctr ?? null,
          avgPosition: row.avgPosition ?? null
        }
      });

      queryRecordsSynced += 1;

      const rollupKey = `${canonicalPageId}:${row.date}`;
      const existing = pageRollups.get(rollupKey) ?? {
        canonicalPageId,
        date: row.date,
        clicks: 0,
        impressions: 0,
        weightedPosition: 0
      };

      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.weightedPosition += avgPosition * impressions;
      pageRollups.set(rollupKey, existing);
    }

    for (const rollup of pageRollups.values()) {
      const ctr =
        rollup.impressions > 0 ? rollup.clicks / rollup.impressions : null;
      const avgPosition =
        rollup.impressions > 0 ? rollup.weightedPosition / rollup.impressions : null;

      await prisma.pageMetricDaily.upsert({
        where: {
          propertyId_canonicalPageId_date: {
            propertyId: input.propertyId,
            canonicalPageId: rollup.canonicalPageId,
            date: new Date(`${rollup.date}T00:00:00.000Z`)
          }
        },
        update: {
          organicClicks: rollup.clicks,
          organicImpressions: rollup.impressions,
          ctr,
          avgPosition
        },
        create: {
          propertyId: input.propertyId,
          canonicalPageId: rollup.canonicalPageId,
          date: new Date(`${rollup.date}T00:00:00.000Z`),
          organicClicks: rollup.clicks,
          organicImpressions: rollup.impressions,
          ctr,
          avgPosition
        }
      });
    }

    return {
      pageRecordsSynced: pageRollups.size,
      queryRecordsSynced,
      unresolvedPageUrls: [...unresolvedPageUrls]
    };
  }
}

export function createGscConnector(input?: {
  provider?: GscProvider;
  metricsStore?: SearchConsoleMetricsStore;
}): ConnectorModule {
  const provider = input?.provider ?? createPlaceholderGscProvider();
  const metricsStore = input?.metricsStore ?? new PrismaSearchConsoleMetricsStore();

  return {
    provider: "gsc",
    oauth: {
      async refreshAccessToken({ credentialReference, credentialStore, now }) {
        const credential = await credentialStore.get(credentialReference);

        if (!credential) {
          throw new ConnectorExecutionError("Missing GSC credential", {
            code: "MISSING_CREDENTIAL",
            retryable: false
          });
        }

        const refreshToken = credential.payload.refreshToken;
        if (typeof refreshToken !== "string" || refreshToken.length === 0) {
          throw new ConnectorExecutionError("Missing GSC refresh token", {
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
    async sync({ connection, now, credentialStore }) {
      const config = parseGscConfig(connection.configJson);

      if (!connection.propertyId) {
        throw new ConnectorExecutionError("GSC sync requires a property binding", {
          code: "MISSING_PROPERTY_BINDING",
          retryable: false
        });
      }

      if (!config.selectedSite?.siteUrl) {
        throw new ConnectorExecutionError("GSC site selection is missing", {
          code: "MISSING_GSC_SITE",
          retryable: false
        });
      }

      if (!connection.credentialRef) {
        throw new ConnectorExecutionError("GSC credential reference is missing", {
          code: "MISSING_CREDENTIAL",
          retryable: false
        });
      }

      const credential = await credentialStore.get(connection.credentialRef);
      if (!credential) {
        throw new ConnectorExecutionError("Missing GSC credential", {
          code: "MISSING_CREDENTIAL",
          retryable: false
        });
      }

      let accessToken = credential.payload.accessToken;
      const expiresAt = credential.payload.expiresAt;
      if (
        typeof accessToken !== "string" ||
        typeof expiresAt !== "string" ||
        new Date(expiresAt).getTime() <= now.getTime()
      ) {
        const refreshed = await this.oauth.refreshAccessToken({
          credentialReference: connection.credentialRef,
          credentialStore,
          now
        });
        accessToken = refreshed.accessToken;
      }

      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new ConnectorExecutionError("Missing GSC access token", {
          code: "MISSING_ACCESS_TOKEN",
          retryable: false
        });
      }

      const dateWindow = readDateWindow(config, now);
      const fetched = await provider.fetchDailyQueryMetrics({
        siteUrl: config.selectedSite.siteUrl,
        startDate: dateWindow.startDate,
        endDate: dateWindow.endDate,
        accessToken
      });

      const ingestion = await metricsStore.ingest({
        propertyId: connection.propertyId,
        rows: fetched.rows
      });

      const segments: ConnectorSyncResult["segments"] = [
        {
          segment: "daily-page-metrics",
          status: "success",
          recordsSynced: ingestion.pageRecordsSynced
        },
        {
          segment: "daily-query-metrics",
          status: "success",
          recordsSynced: ingestion.queryRecordsSynced
        },
        ...fetched.failures.map((failure) => ({
          segment: failure.segment,
          status: "failed" as const,
          retryable: failure.retryable,
          code: failure.code,
          message: failure.message
        }))
      ];

      if (ingestion.unresolvedPageUrls.length > 0) {
        segments.push({
          segment: "page-resolution",
          status: "failed",
          retryable: false,
          code: "UNRESOLVED_PAGE_URLS",
          message: `Unresolved page URLs: ${ingestion.unresolvedPageUrls.join(", ")}`
        });
      }

      return {
        fetchedAt: now,
        latestDataAt: parseIsoDay(fetched.latestDataDate),
        segments,
        connectionUpdates: {
          configJson: {
            ...(connection.configJson ?? {}),
            pendingBackfill: null,
            lastCompletedSync: {
              startDate: dateWindow.startDate,
              endDate: dateWindow.endDate,
              latestDataDate: fetched.latestDataDate,
              checkedAt: now.toISOString()
            }
          }
        }
      };
    }
  };
}
