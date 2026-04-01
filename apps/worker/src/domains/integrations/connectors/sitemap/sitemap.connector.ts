import { prisma } from "@webops-wizard/db";

import type {
  ConnectorModule,
  ConnectorSyncResult
} from "../connector.types";
import { ConnectorExecutionError } from "../../sync/retry";

import {
  buildPrimarySitemapCandidates,
  buildRobotsUrl,
  discoverSitemapCandidates
} from "./sitemap.discovery";
import { PrismaSitemapPersistenceStore } from "./sitemap.persistence";
import { traverseSitemaps } from "./sitemap.traversal";

interface SitemapConfig {
  sitemapUrl?: string;
  maxSitemapsPerRun?: number;
  maxUrlsPerRun?: number;
}

export interface SitemapFetcher {
  fetchText(url: string): Promise<string>;
}

export interface SitemapPropertyStore {
  getProperty(propertyId: string): Promise<{
    id: string;
    primaryDomain: string;
  } | null>;
}

export interface DiscoveredSitemapUrl {
  rawUrl: string;
  normalizedUrlKey: string;
  discoveredFrom: string[];
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

export interface SitemapPersistenceStore {
  ingest(input: {
    propertyId: string;
    discoveredAt: Date;
    urls: DiscoveredSitemapUrl[];
  }): Promise<{
    recordsSynced: number;
  }>;
}

class DefaultSitemapFetcher implements SitemapFetcher {
  async fetchText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.text();
  }
}

class PrismaSitemapPropertyStore implements SitemapPropertyStore {
  async getProperty(propertyId: string) {
    return prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        primaryDomain: true
      }
    });
  }
}

function parseConfig(configJson: Record<string, unknown> | null): SitemapConfig {
  if (!configJson) {
    return {};
  }

  return configJson as SitemapConfig;
}

async function fetchRobotsCandidates(input: {
  primaryDomain: string;
  fetcher: SitemapFetcher;
  configuredSitemapUrl?: string | null;
}) {
  const robotsUrl = buildRobotsUrl(input.primaryDomain);
  const primaryCandidates = new Set(
    buildPrimarySitemapCandidates({
      primaryDomain: input.primaryDomain,
      configuredSitemapUrl: input.configuredSitemapUrl ?? null
    })
  );
  const discovery = await discoverSitemapCandidates({
    primaryDomain: input.primaryDomain,
    fetchText: async (url) => {
      if (url !== robotsUrl) {
        throw new Error(`Unexpected discovery fetch url: ${url}`);
      }

      return input.fetcher.fetchText(url);
    }
  });

  return {
    robotsUrl,
    candidates: discovery.candidates.filter((candidate) => !primaryCandidates.has(candidate))
  };
}

export function createSitemapConnector(input?: {
  fetcher?: SitemapFetcher;
  propertyStore?: SitemapPropertyStore;
  persistenceStore?: SitemapPersistenceStore;
}): ConnectorModule {
  const fetcher = input?.fetcher ?? new DefaultSitemapFetcher();
  const propertyStore = input?.propertyStore ?? new PrismaSitemapPropertyStore();
  const persistenceStore =
    input?.persistenceStore ?? new PrismaSitemapPersistenceStore();

  return {
    provider: "sitemap",
    oauth: {
      async refreshAccessToken() {
        throw new ConnectorExecutionError("Sitemap connector does not use OAuth", {
          code: "OAUTH_UNSUPPORTED",
          retryable: false
        });
      }
    },
    async sync({ connection, now }) {
      if (!connection.propertyId) {
        throw new ConnectorExecutionError("Sitemap sync requires a property binding", {
          code: "MISSING_PROPERTY_BINDING",
          retryable: false
        });
      }

      const property = await propertyStore.getProperty(connection.propertyId);
      if (!property) {
        throw new ConnectorExecutionError("Property not found for sitemap sync", {
          code: "PROPERTY_NOT_FOUND",
          retryable: false
        });
      }

      const config = parseConfig(connection.configJson);
      const segments: ConnectorSyncResult["segments"] = [
        {
          segment: "discovery",
          status: "success"
        }
      ];

      const primaryCandidates = buildPrimarySitemapCandidates({
        primaryDomain: property.primaryDomain,
        configuredSitemapUrl: config.sitemapUrl ?? null
      });

      const traversalLimits = {
        ...(config.maxSitemapsPerRun !== undefined
          ? { maxSitemapsPerRun: config.maxSitemapsPerRun }
          : {}),
        ...(config.maxUrlsPerRun !== undefined
          ? { maxUrlsPerRun: config.maxUrlsPerRun }
          : {})
      };

      let traversed = await traverseSitemaps({
        initialSitemapUrls: primaryCandidates,
        fetchText: (url) => fetcher.fetchText(url),
        ...traversalLimits
      });

      segments.push(...traversed.segments);

      if (traversed.urls.length === 0) {
        try {
          const robots = await fetchRobotsCandidates({
            primaryDomain: property.primaryDomain,
            fetcher,
            configuredSitemapUrl: config.sitemapUrl ?? null
          });

          segments.push({
            segment: `fetch:${robots.robotsUrl}`,
            status: "success"
          });

          traversed = await traverseSitemaps({
            initialSitemapUrls: robots.candidates,
            fetchText: (url) => fetcher.fetchText(url),
            ...traversalLimits
          });

          segments.push(...traversed.segments);
        } catch (error) {
          segments.push({
            segment: `fetch:${buildRobotsUrl(property.primaryDomain)}`,
            status: "failed",
            code: "ROBOTS_FETCH_FAILED",
            message: error instanceof Error ? error.message : "Failed to fetch robots.txt",
            retryable: true
          });
        }
      }

      const persisted = await persistenceStore.ingest({
        propertyId: property.id,
        discoveredAt: now,
        urls: traversed.urls
      });

      segments.push({
        segment: "persist",
        status: "success",
        recordsSynced: persisted.recordsSynced
      });

      return {
        fetchedAt: now,
        latestDataAt: traversed.latestDataAt,
        segments
      } satisfies ConnectorSyncResult;
    }
  };
}
