import { prisma } from "@webops-wizard/db";

import type { ConnectorModule, ConnectorSyncResult } from "../connector.types";
import { ConnectorExecutionError } from "../../sync/retry";
import type { ExtractedPageSnapshot } from "./crawler.extract";
import { extractPageSnapshot } from "./crawler.extract";
import {
  CrawlerPageFetchEngine,
  DefaultCrawlerPageFetchEngine
} from "./crawler.fetch";
import {
  CrawlerPersistenceStore,
  PrismaCrawlerPersistenceStore
} from "./crawler.persistence";
import { parseRobotsTxt, isAllowedByRobots, type RobotsRuleSet } from "./crawler.robots";
import { buildCrawlerSeeds } from "./crawler.seeding";
import {
  isSamePropertyDomain,
  normalizeCrawlerUrlKey,
  passesIncludeExcludeRules
} from "./crawler.rules";

interface CrawlerConfig {
  fetchMode?: "html";
  maxDepth?: number;
  maxPagesPerRun?: number;
  fetchTimeoutMs?: number;
  userAgent?: string;
  seedUrls?: string[];
  includeRules?: string[];
  excludeRules?: string[];
}

const DEFAULT_MAX_DEPTH = 1;
const DEFAULT_MAX_PAGES_PER_RUN = 250;
const DEFAULT_FETCH_TIMEOUT_MS = 10000;
const DEFAULT_USER_AGENT = "WebOpsWizardCrawler/1.0";

export interface CrawlerPropertyStore {
  getProperty(propertyId: string): Promise<{
    id: string;
    primaryDomain: string;
    includeRules?: string[];
    excludeRules?: string[];
  } | null>;
}

export interface CrawlerSeedUrlRecordStore {
  listSeedUrlRecords(propertyId: string): Promise<{
    sitemapUrlRecords: Array<{ rawUrl: string; normalizedUrlKey: string }>;
    fallbackUrlRecords: Array<{ rawUrl: string; normalizedUrlKey: string }>;
  }>;
}

export interface RobotsTxtFetcher {
  fetch(host: string): Promise<string>;
}

class PrismaCrawlerPropertyStore implements CrawlerPropertyStore {
  async getProperty(propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        primaryDomain: true,
        settings: {
          select: {
            includeRulesJson: true,
            excludeRulesJson: true
          },
          take: 1
        }
      }
    });

    if (!property) {
      return null;
    }

    const settings = property.settings[0];
    return {
      id: property.id,
      primaryDomain: property.primaryDomain,
      includeRules: Array.isArray(settings?.includeRulesJson)
        ? settings.includeRulesJson.filter((value): value is string => typeof value === "string")
        : [],
      excludeRules: Array.isArray(settings?.excludeRulesJson)
        ? settings.excludeRulesJson.filter((value): value is string => typeof value === "string")
        : []
    };
  }
}

class PrismaCrawlerSeedUrlRecordStore implements CrawlerSeedUrlRecordStore {
  async listSeedUrlRecords(propertyId: string) {
    const records = await prisma.urlRecord.findMany({
      where: {
        propertyId
      },
      select: {
        rawUrl: true,
        normalizedUrlKey: true,
        source: true,
        metadataJson: true,
        isCurrentAlias: true
      },
      orderBy: {
        firstSeenAt: "asc"
      }
    });

    return {
      sitemapUrlRecords: records
        .filter(
          (record) =>
            record.source === "sitemap" ||
            (record.metadataJson &&
              typeof record.metadataJson === "object" &&
              "provider" in record.metadataJson &&
              record.metadataJson.provider === "sitemap")
        )
        .map((record) => ({
          rawUrl: record.rawUrl,
          normalizedUrlKey: record.normalizedUrlKey
        })),
      fallbackUrlRecords: records
        .filter((record) => record.isCurrentAlias)
        .map((record) => ({
          rawUrl: record.rawUrl,
          normalizedUrlKey: record.normalizedUrlKey
        }))
    };
  }
}

class DefaultRobotsTxtFetcher implements RobotsTxtFetcher {
  async fetch(host: string) {
    const response = await fetch(`https://${host}/robots.txt`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for robots.txt on ${host}`);
    }

    return response.text();
  }
}

function parseConfig(configJson: Record<string, unknown> | null): CrawlerConfig {
  if (!configJson) {
    return {};
  }

  return configJson as CrawlerConfig;
}

function parseRules(value: string[] | undefined, fallback: string[] | undefined): string[] {
  return value ?? fallback ?? [];
}

function isHtmlResponse(contentType: string | null, html: string | null): boolean {
  return Boolean(html) && Boolean(contentType?.toLowerCase().includes("text/html"));
}

function dedupeDiscoveredUrls(
  urls: string[],
  propertyId: string,
  discoveredAt: Date
): Array<{
  rawUrl: string;
  normalizedUrlKey: string;
  source: "crawler";
  discoveredAt: Date;
}> {
  const byKey = new Map<
    string,
    {
      rawUrl: string;
      normalizedUrlKey: string;
      source: "crawler";
      discoveredAt: Date;
    }
  >();

  for (const url of urls) {
    void propertyId;
    try {
      const normalizedUrlKey = normalizeCrawlerUrlKey(url);
      if (!byKey.has(normalizedUrlKey)) {
        byKey.set(normalizedUrlKey, {
          rawUrl: url,
          normalizedUrlKey,
          source: "crawler",
          discoveredAt
        });
      }
    } catch {
      continue;
    }
  }

  return [...byKey.values()];
}

export { type CrawlerPageFetchEngine, type CrawlerPersistenceStore };

export function createCrawlerConnector(input?: {
  propertyStore?: CrawlerPropertyStore;
  seedUrlRecordStore?: CrawlerSeedUrlRecordStore;
  robotsTxtFetcher?: RobotsTxtFetcher;
  pageFetchEngine?: CrawlerPageFetchEngine;
  persistenceStore?: CrawlerPersistenceStore;
}): ConnectorModule {
  const propertyStore = input?.propertyStore ?? new PrismaCrawlerPropertyStore();
  const seedUrlRecordStore =
    input?.seedUrlRecordStore ?? new PrismaCrawlerSeedUrlRecordStore();
  const robotsTxtFetcher = input?.robotsTxtFetcher ?? new DefaultRobotsTxtFetcher();
  const pageFetchEngine = input?.pageFetchEngine ?? new DefaultCrawlerPageFetchEngine();
  const persistenceStore =
    input?.persistenceStore ?? new PrismaCrawlerPersistenceStore();

  return {
    provider: "crawler",
    oauth: {
      async refreshAccessToken() {
        throw new ConnectorExecutionError("Crawler connector does not use OAuth", {
          code: "OAUTH_UNSUPPORTED",
          retryable: false
        });
      }
    },
    async sync({ connection, now }) {
      if (!connection.propertyId) {
        throw new ConnectorExecutionError("Crawler sync requires a property binding", {
          code: "MISSING_PROPERTY_BINDING",
          retryable: false
        });
      }

      const property = await propertyStore.getProperty(connection.propertyId);
      if (!property) {
        throw new ConnectorExecutionError("Property not found for crawler sync", {
          code: "PROPERTY_NOT_FOUND",
          retryable: false
        });
      }

      const config = parseConfig(connection.configJson);
      if (config.fetchMode && config.fetchMode !== "html") {
        throw new ConnectorExecutionError("Crawler v1 only supports html fetch mode", {
          code: "UNSUPPORTED_FETCH_MODE",
          retryable: false
        });
      }

      const fetchMode = "html" as const;
      const maxDepth = Math.max(0, Math.floor(config.maxDepth ?? DEFAULT_MAX_DEPTH));
      const maxPagesPerRun = Math.max(
        1,
        Math.floor(config.maxPagesPerRun ?? DEFAULT_MAX_PAGES_PER_RUN)
      );
      const fetchTimeoutMs = Math.max(
        1,
        Math.floor(config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS)
      );
      const userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
      const includeRules = parseRules(config.includeRules, property.includeRules);
      const excludeRules = parseRules(config.excludeRules, property.excludeRules);

      const seedRecords = await seedUrlRecordStore.listSeedUrlRecords(property.id);
      const seeds = buildCrawlerSeeds({
        primaryDomain: property.primaryDomain,
        seedUrls: config.seedUrls ?? [],
        sitemapUrlRecords: seedRecords.sitemapUrlRecords,
        fallbackUrlRecords: seedRecords.fallbackUrlRecords,
        includeRules,
        excludeRules
      });

      const segments: ConnectorSyncResult["segments"] = [
        {
          segment: "seed",
          status: "success",
          recordsSynced: seeds.length
        }
      ];
      const queue = [...seeds];
      const visited = new Set<string>();
      const queuedDepthByKey = new Map(queue.map((seed) => [seed.normalizedUrlKey, seed.depth]));
      const robotsCache = new Map<string, RobotsRuleSet>();
      let persistedSnapshots = 0;
      let latestDataAt: Date | null = null;

      while (queue.length > 0 && visited.size < maxPagesPerRun) {
        const next = queue.shift();
        if (!next || visited.has(next.normalizedUrlKey)) {
          continue;
        }

        visited.add(next.normalizedUrlKey);

        let host: string;
        try {
          host = new URL(next.rawUrl).hostname.toLowerCase();
        } catch {
          segments.push({
            segment: `fetch:${next.rawUrl}`,
            status: "failed",
            code: "INVALID_URL",
            message: `Invalid crawl URL: ${next.rawUrl}`,
            retryable: false
          });
          continue;
        }

        let robots = robotsCache.get(host);
        if (!robots) {
          try {
            robots = parseRobotsTxt(await robotsTxtFetcher.fetch(host));
            robotsCache.set(host, robots);
            segments.push({
              segment: `robots:${host}`,
              status: "success"
            });
          } catch (error) {
            segments.push({
              segment: `robots:${host}`,
              status: "failed",
              code: "ROBOTS_FETCH_FAILED",
              message: error instanceof Error ? error.message : "Failed to fetch robots.txt",
              retryable: true
            });
            continue;
          }
        }

        if (
          !isAllowedByRobots({
            rules: robots,
            userAgent,
            url: next.rawUrl
          })
        ) {
          segments.push({
            segment: `fetch:${next.rawUrl}`,
            status: "failed",
            code: "ROBOTS_DISALLOWED",
            message: `robots.txt disallows ${next.rawUrl}`,
            retryable: false
          });
          continue;
        }

        let fetched: Awaited<ReturnType<CrawlerPageFetchEngine["fetch"]>>;
        try {
          fetched = await pageFetchEngine.fetch({
            url: next.rawUrl,
            userAgent,
            timeoutMs: fetchTimeoutMs
          });
          segments.push({
            segment: `fetch:${next.rawUrl}`,
            status: "success"
          });
        } catch (error) {
          segments.push({
            segment: `fetch:${next.rawUrl}`,
            status: "failed",
            code: "PAGE_FETCH_FAILED",
            message: error instanceof Error ? error.message : "Failed to fetch page",
            retryable: true
          });
          continue;
        }

        const extracted: ExtractedPageSnapshot | null = isHtmlResponse(
          fetched.contentType,
          fetched.html
        )
          ? extractPageSnapshot({
              html: fetched.html ?? "",
              baseUrl: fetched.finalUrl,
              primaryDomain: property.primaryDomain
            })
          : null;

        try {
          await persistenceStore.upsertSnapshot({
            propertyId: property.id,
            normalizedUrlKey: next.normalizedUrlKey,
            canonicalUrl: fetched.finalUrl,
            requestedUrl: fetched.requestedUrl,
            finalUrl: fetched.finalUrl,
            statusCode: fetched.statusCode,
            fetchMode,
            crawlDepth: next.depth,
            extracted,
            snapshotHtml: extracted ? fetched.html : null,
            snapshotDate: now,
            discoveredAt: now
          });
          segments.push({
            segment: `persist:${next.rawUrl}`,
            status: "success"
          });
          persistedSnapshots += 1;
          latestDataAt = now;
        } catch (error) {
          segments.push({
            segment: `persist:${next.rawUrl}`,
            status: "failed",
            code: "PERSIST_FAILED",
            message: error instanceof Error ? error.message : "Failed to persist snapshot",
            retryable: true
          });
          continue;
        }

        if (!extracted || next.depth >= maxDepth) {
          continue;
        }

        const discoveredUrls = dedupeDiscoveredUrls(
          extracted.discoveredInternalUrls.filter(
            (url) =>
              isSamePropertyDomain(url, property.primaryDomain) &&
              passesIncludeExcludeRules({
                url,
                includeRules,
                excludeRules
              })
          ),
          property.id,
          now
        );

        if (discoveredUrls.length > 0) {
          await persistenceStore.recordDiscoveredUrls({
            propertyId: property.id,
            urls: discoveredUrls
          });
        }

        for (const discovered of discoveredUrls) {
          if (visited.has(discovered.normalizedUrlKey)) {
            continue;
          }

          const nextDepth = next.depth + 1;
          if (nextDepth > maxDepth) {
            continue;
          }

          const existingDepth = queuedDepthByKey.get(discovered.normalizedUrlKey);
          if (existingDepth !== undefined && existingDepth <= nextDepth) {
            continue;
          }

          queuedDepthByKey.set(discovered.normalizedUrlKey, nextDepth);
          queue.push({
            rawUrl: discovered.rawUrl,
            normalizedUrlKey: discovered.normalizedUrlKey,
            depth: nextDepth
          });
        }
      }

      return {
        fetchedAt: now,
        latestDataAt: persistedSnapshots > 0 ? latestDataAt : null,
        segments
      };
    }
  };
}
