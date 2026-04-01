import { describe, expect, it } from "vitest";

import { InMemoryCredentialStore } from "../../credentials/in-memory-credential-store";
import { createRetryPolicy } from "../../sync/retry";
import { InMemorySyncPersistence, runConnectorSync } from "../../sync/sync-runner";
import {
  createCrawlerConnector,
  type CrawlerPageFetchEngine,
  type CrawlerPersistenceStore,
  type CrawlerPropertyStore,
  type CrawlerSeedUrlRecordStore,
  type RobotsTxtFetcher
} from "./crawler.connector";
import { extractPageSnapshot } from "./crawler.extract";
import { isAllowedByRobots, parseRobotsTxt } from "./crawler.robots";
import { buildCrawlerSeeds } from "./crawler.seeding";

class FakeCrawlerPropertyStore implements CrawlerPropertyStore {
  constructor(
    private readonly property: {
      id: string;
      primaryDomain: string;
      includeRules?: string[];
      excludeRules?: string[];
    } | null = {
      id: "prop_1",
      primaryDomain: "example.com"
    }
  ) {}

  async getProperty() {
    return this.property;
  }
}

class FakeCrawlerSeedUrlRecordStore implements CrawlerSeedUrlRecordStore {
  constructor(
    private readonly records: {
      sitemapUrlRecords: Array<{ rawUrl: string; normalizedUrlKey: string }>;
      fallbackUrlRecords: Array<{ rawUrl: string; normalizedUrlKey: string }>;
    }
  ) {}

  async listSeedUrlRecords() {
    return this.records;
  }
}

class FakeRobotsTxtFetcher implements RobotsTxtFetcher {
  readonly fetchedHosts: string[] = [];

  constructor(private readonly robotsByHost: Record<string, string | Error>) {}

  async fetch(host: string) {
    this.fetchedHosts.push(host);
    const response = this.robotsByHost[host];

    if (response instanceof Error) {
      throw response;
    }

    return response ?? "User-agent: *\nAllow: /";
  }
}

class FakeCrawlerPageFetchEngine implements CrawlerPageFetchEngine {
  readonly mode = "html" as const;
  readonly fetchedUrls: string[] = [];

  constructor(
    private readonly responses: Record<
      string,
      | {
          requestedUrl: string;
          finalUrl: string;
          statusCode: number;
          contentType: string | null;
          html: string | null;
        }
      | Error
    >
  ) {}

  async fetch(input: { url: string }) {
    this.fetchedUrls.push(input.url);
    const response = this.responses[input.url];

    if (response instanceof Error) {
      throw response;
    }

    if (!response) {
      throw new Error(`Unexpected fetch: ${input.url}`);
    }

    return response;
  }
}

class InMemoryCrawlerPersistenceStore implements CrawlerPersistenceStore {
  readonly snapshots: Array<Record<string, unknown>> = [];
  readonly discoveredUrlRecords: Array<Record<string, unknown>> = [];

  async upsertSnapshot(input: Record<string, unknown>) {
    this.snapshots.push(input);
  }

  async recordDiscoveredUrls(input: {
    propertyId: string;
    urls: Array<{
      rawUrl: string;
      normalizedUrlKey: string;
      source: "crawler";
      discoveredAt: Date;
    }>;
  }) {
    this.discoveredUrlRecords.push(input);
  }
}

describe("crawler connector", () => {
  it("requires a property binding for crawler sync", async () => {
    const connector = createCrawlerConnector();

    await expect(
      connector.sync({
        connection: {
          id: "ic_crawler_missing_property",
          workspaceId: "ws_1",
          propertyId: null,
          provider: "crawler",
          credentialRef: null,
          freshnessSlaMinutes: 60,
          configJson: null
        },
        now: new Date("2026-04-01T04:00:00.000Z"),
        credentialStore: new InMemoryCredentialStore()
      })
    ).rejects.toMatchObject({
      code: "MISSING_PROPERTY_BINDING"
    });
  });

  it("prefers explicit and sitemap-backed seeds, applies include/exclude rules, and normalizes urls", () => {
    const seeds = buildCrawlerSeeds({
      primaryDomain: "example.com",
      seedUrls: [
        "https://example.com/pricing/",
        "https://example.com/blocked",
        "https://other.com/offsite"
      ],
      sitemapUrlRecords: [
        {
          rawUrl: "https://example.com/pricing",
          normalizedUrlKey: "example.com/pricing"
        },
        {
          rawUrl: "https://example.com/blog/post-1?utm_source=test",
          normalizedUrlKey: "example.com/blog/post-1"
        }
      ],
      fallbackUrlRecords: [
        {
          rawUrl: "https://example.com/fallback",
          normalizedUrlKey: "example.com/fallback"
        }
      ],
      includeRules: ["/pricing", "/blog"],
      excludeRules: ["/blocked"]
    });

    expect(seeds).toEqual([
      {
        rawUrl: "https://example.com/pricing/",
        normalizedUrlKey: "example.com/pricing",
        depth: 0
      },
      {
        rawUrl: "https://example.com/blog/post-1?utm_source=test",
        normalizedUrlKey: "example.com/blog/post-1",
        depth: 0
      }
    ]);
  });

  it("falls back to current aliases when sitemap-backed seeds are unavailable", () => {
    const seeds = buildCrawlerSeeds({
      primaryDomain: "example.com",
      seedUrls: [],
      sitemapUrlRecords: [],
      fallbackUrlRecords: [
        {
          rawUrl: "https://example.com/fallback/",
          normalizedUrlKey: "example.com/fallback"
        }
      ],
      includeRules: [],
      excludeRules: []
    });

    expect(seeds).toEqual([
      {
        rawUrl: "https://example.com/fallback/",
        normalizedUrlKey: "example.com/fallback",
        depth: 0
      }
    ]);
  });

  it("extracts title, meta description, first h1, canonical target, and internal links from html", () => {
    const extracted = extractPageSnapshot({
      html: `
        <html>
          <head>
            <title>  Pricing  </title>
            <meta name="description" content=" Compare plans ">
            <link rel="canonical" href="/pricing" />
          </head>
          <body>
            <h1> Pricing </h1>
            <a href="/contact">Contact</a>
            <a href="https://example.com/blog">Blog</a>
            <a href="https://other.com/offsite">Offsite</a>
          </body>
        </html>
      `,
      baseUrl: "https://example.com/pricing?utm_source=test",
      primaryDomain: "example.com"
    });

    expect(extracted).toMatchObject({
      title: "Pricing",
      metaTitle: "Pricing",
      metaDescription: "Compare plans",
      h1: "Pricing",
      canonicalTargetUrl: "https://example.com/pricing",
      internalLinkCount: 2
    });

    expect(extracted.discoveredInternalUrls).toEqual([
      "https://example.com/contact",
      "https://example.com/blog"
    ]);
  });

  it("applies robots allow and disallow rules using the most specific path match", () => {
    const rules = parseRobotsTxt(`
      User-agent: *
      Disallow: /private
      Allow: /private/public
    `);

    expect(
      isAllowedByRobots({
        rules,
        userAgent: "WebOpsBot",
        url: "https://example.com/private/report"
      })
    ).toBe(false);

    expect(
      isAllowedByRobots({
        rules,
        userAgent: "WebOpsBot",
        url: "https://example.com/private/public/page"
      })
    ).toBe(true);
  });

  it("crawls html pages, expands shallow internal links, and stores raw html snapshots", async () => {
    const fetchEngine = new FakeCrawlerPageFetchEngine({
      "https://example.com/pricing": {
        requestedUrl: "https://example.com/pricing",
        finalUrl: "https://example.com/pricing",
        statusCode: 200,
        contentType: "text/html; charset=utf-8",
        html: `
          <html>
            <head>
              <title>Pricing</title>
              <meta name="description" content="Compare plans">
              <link rel="canonical" href="/pricing" />
            </head>
            <body>
              <h1>Pricing</h1>
              <a href="/contact">Contact</a>
              <a href="https://other.com/offsite">Offsite</a>
            </body>
          </html>
        `
      },
      "https://example.com/contact": {
        requestedUrl: "https://example.com/contact",
        finalUrl: "https://example.com/contact",
        statusCode: 200,
        contentType: "text/html; charset=utf-8",
        html: `
          <html>
            <head><title>Contact</title></head>
            <body><h1>Contact</h1></body>
          </html>
        `
      }
    });
    const persistence = new InMemoryCrawlerPersistenceStore();
    const connector = createCrawlerConnector({
      propertyStore: new FakeCrawlerPropertyStore(),
      seedUrlRecordStore: new FakeCrawlerSeedUrlRecordStore({
        sitemapUrlRecords: [
          {
            rawUrl: "https://example.com/pricing",
            normalizedUrlKey: "example.com/pricing"
          }
        ],
        fallbackUrlRecords: []
      }),
      robotsTxtFetcher: new FakeRobotsTxtFetcher({
        "example.com": "User-agent: *\nAllow: /"
      }),
      pageFetchEngine: fetchEngine,
      persistenceStore: persistence
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_crawler_1",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "crawler",
        credentialRef: null,
        freshnessSlaMinutes: 60,
        configJson: {
          fetchMode: "html",
          maxDepth: 1,
          maxPagesPerRun: 10
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T05:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(result.status).toBe("success");
    expect(fetchEngine.fetchedUrls).toEqual([
      "https://example.com/pricing",
      "https://example.com/contact"
    ]);
    expect(persistence.snapshots).toHaveLength(2);
    expect(persistence.snapshots[0]).toMatchObject({
      propertyId: "prop_1",
      normalizedUrlKey: "example.com/pricing",
      requestedUrl: "https://example.com/pricing",
      finalUrl: "https://example.com/pricing",
      statusCode: 200,
      fetchMode: "html",
      crawlDepth: 0,
      snapshotHtml: expect.stringContaining("<title>Pricing</title>")
    });
    expect(persistence.snapshots[1]).toMatchObject({
      normalizedUrlKey: "example.com/contact",
      crawlDepth: 1
    });
    expect(persistence.discoveredUrlRecords[0]).toMatchObject({
      propertyId: "prop_1"
    });
  });

  it("records status code for non-html responses without storing html extraction", async () => {
    const persistence = new InMemoryCrawlerPersistenceStore();
    const connector = createCrawlerConnector({
      propertyStore: new FakeCrawlerPropertyStore(),
      seedUrlRecordStore: new FakeCrawlerSeedUrlRecordStore({
        sitemapUrlRecords: [
          {
            rawUrl: "https://example.com/download",
            normalizedUrlKey: "example.com/download"
          }
        ],
        fallbackUrlRecords: []
      }),
      robotsTxtFetcher: new FakeRobotsTxtFetcher({
        "example.com": "User-agent: *\nAllow: /"
      }),
      pageFetchEngine: new FakeCrawlerPageFetchEngine({
        "https://example.com/download": {
          requestedUrl: "https://example.com/download",
          finalUrl: "https://example.com/files/pricing.pdf",
          statusCode: 302,
          contentType: "application/pdf",
          html: null
        }
      }),
      persistenceStore: persistence
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_crawler_2",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "crawler",
        credentialRef: null,
        freshnessSlaMinutes: 60,
        configJson: {
          fetchMode: "html",
          maxDepth: 0,
          maxPagesPerRun: 10
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T05:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(result.status).toBe("success");
    expect(persistence.snapshots).toEqual([
      expect.objectContaining({
        normalizedUrlKey: "example.com/download",
        statusCode: 302,
        finalUrl: "https://example.com/files/pricing.pdf",
        snapshotHtml: null,
        extracted: null
      })
    ]);
  });

  it("returns partial failure when one crawler fetch fails after another page persists", async () => {
    const connector = createCrawlerConnector({
      propertyStore: new FakeCrawlerPropertyStore(),
      seedUrlRecordStore: new FakeCrawlerSeedUrlRecordStore({
        sitemapUrlRecords: [
          {
            rawUrl: "https://example.com/pricing",
            normalizedUrlKey: "example.com/pricing"
          },
          {
            rawUrl: "https://example.com/blog",
            normalizedUrlKey: "example.com/blog"
          }
        ],
        fallbackUrlRecords: []
      }),
      robotsTxtFetcher: new FakeRobotsTxtFetcher({
        "example.com": "User-agent: *\nAllow: /"
      }),
      pageFetchEngine: new FakeCrawlerPageFetchEngine({
        "https://example.com/pricing": {
          requestedUrl: "https://example.com/pricing",
          finalUrl: "https://example.com/pricing",
          statusCode: 200,
          contentType: "text/html",
          html: "<html><head><title>Pricing</title></head><body><h1>Pricing</h1></body></html>"
        },
        "https://example.com/blog": new Error("timeout")
      }),
      persistenceStore: new InMemoryCrawlerPersistenceStore()
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_crawler_3",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "crawler",
        credentialRef: null,
        freshnessSlaMinutes: 60,
        configJson: {
          fetchMode: "html",
          maxDepth: 0,
          maxPagesPerRun: 10
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T05:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        segment: "fetch:https://example.com/blog",
        retryable: true
      })
    );
  });
});
