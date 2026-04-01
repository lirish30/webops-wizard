import { describe, expect, it } from "vitest";

import { InMemoryCredentialStore } from "../../credentials/in-memory-credential-store";
import { createRetryPolicy } from "../../sync/retry";
import { InMemorySyncPersistence, runConnectorSync } from "../../sync/sync-runner";
import {
  createSitemapConnector,
  type DiscoveredSitemapUrl,
  type SitemapFetcher,
  type SitemapPersistenceStore,
  type SitemapPropertyStore
} from "./sitemap.connector";

class FakeSitemapFetcher implements SitemapFetcher {
  readonly fetchedUrls: string[] = [];

  constructor(
    private readonly responses: Record<
      string,
      { ok: true; body: string } | { ok: false; message: string }
    >
  ) {}

  async fetchText(url: string) {
    this.fetchedUrls.push(url);
    const response = this.responses[url];

    if (!response) {
      throw new Error(`Unexpected fetch: ${url}`);
    }

    if (!response.ok) {
      throw new Error(response.message);
    }

    return response.body;
  }
}

class FakeSitemapPropertyStore implements SitemapPropertyStore {
  async getProperty(propertyId: string) {
    return {
      id: propertyId,
      primaryDomain: "example.com"
    };
  }
}

class InMemorySitemapPersistenceStore implements SitemapPersistenceStore {
  readonly ingestedBatches: Array<{
    propertyId: string;
    discoveredAt: Date;
    urls: DiscoveredSitemapUrl[];
  }> = [];

  async ingest(input: {
    propertyId: string;
    discoveredAt: Date;
    urls: DiscoveredSitemapUrl[];
  }) {
    this.ingestedBatches.push(input);

    return {
      recordsSynced: input.urls.length
    };
  }
}

describe("sitemap connector", () => {
  it("falls back from configured sitemap to /sitemap.xml and robots.txt discovery", async () => {
    const fetcher = new FakeSitemapFetcher({
      "https://example.com/custom.xml": { ok: false, message: "not found" },
      "https://example.com/sitemap.xml": { ok: false, message: "not found" },
      "https://example.com/robots.txt": {
        ok: true,
        body: ["User-agent: *", "Sitemap: https://example.com/robots-sitemap.xml"].join(
          "\n"
        )
      },
      "https://example.com/robots-sitemap.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/pricing</loc>
            </url>
          </urlset>`
      }
    });
    const persistence = new InMemorySitemapPersistenceStore();
    const connector = createSitemapConnector({
      fetcher,
      propertyStore: new FakeSitemapPropertyStore(),
      persistenceStore: persistence
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_sitemap_1",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "sitemap",
        credentialRef: null,
        freshnessSlaMinutes: 60,
        configJson: {
          sitemapUrl: "https://example.com/custom.xml"
        }
      },
      trigger: "manual",
      now: new Date("2026-04-01T04:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(fetcher.fetchedUrls).toEqual([
      "https://example.com/custom.xml",
      "https://example.com/sitemap.xml",
      "https://example.com/robots.txt",
      "https://example.com/robots-sitemap.xml"
    ]);
    expect(result.status).toBe("partial_failed");
    expect(persistence.ingestedBatches[0]?.urls).toHaveLength(1);
  });

  it("walks sitemap indexes, deduplicates child sitemaps, and merges repeated URL metadata", async () => {
    const fetcher = new FakeSitemapFetcher({
      "https://example.com/sitemap.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/pages-a.xml</loc></sitemap>
            <sitemap><loc>https://example.com/pages-b.xml</loc></sitemap>
            <sitemap><loc>https://example.com/pages-a.xml</loc></sitemap>
          </sitemapindex>`
      },
      "https://example.com/pages-a.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/pricing/</loc>
              <lastmod>2026-03-30</lastmod>
            </url>
          </urlset>`
      },
      "https://example.com/pages-b.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/pricing</loc>
              <lastmod>2026-03-31</lastmod>
              <changefreq>weekly</changefreq>
              <priority>0.8</priority>
            </url>
            <url>
              <loc>https://example.com/blog</loc>
            </url>
          </urlset>`
      }
    });
    const persistence = new InMemorySitemapPersistenceStore();
    const connector = createSitemapConnector({
      fetcher,
      propertyStore: new FakeSitemapPropertyStore(),
      persistenceStore: persistence
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_sitemap_2",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "sitemap",
        credentialRef: null,
        freshnessSlaMinutes: 60 * 24 * 14,
        configJson: null
      },
      trigger: "schedule",
      now: new Date("2026-04-01T04:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(result.status).toBe("success");
    expect(fetcher.fetchedUrls).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/pages-a.xml",
      "https://example.com/pages-b.xml"
    ]);

    expect(persistence.ingestedBatches[0]?.urls).toEqual([
      {
        rawUrl: "https://example.com/pricing/",
        normalizedUrlKey: "example.com/pricing",
        discoveredFrom: [
          "https://example.com/pages-a.xml",
          "https://example.com/pages-b.xml"
        ],
        lastmod: "2026-03-31T00:00:00.000Z",
        changefreq: "weekly",
        priority: 0.8
      },
      {
        rawUrl: "https://example.com/blog",
        normalizedUrlKey: "example.com/blog",
        discoveredFrom: ["https://example.com/pages-b.xml"],
        lastmod: null,
        changefreq: null,
        priority: null
      }
    ]);
  });

  it("returns partial failure when a child sitemap fails after other urls persist", async () => {
    const fetcher = new FakeSitemapFetcher({
      "https://example.com/sitemap.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/pages-a.xml</loc></sitemap>
            <sitemap><loc>https://example.com/pages-b.xml</loc></sitemap>
          </sitemapindex>`
      },
      "https://example.com/pages-a.xml": {
        ok: true,
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/</loc></url>
          </urlset>`
      },
      "https://example.com/pages-b.xml": {
        ok: false,
        message: "timeout"
      }
    });
    const persistence = new InMemorySitemapPersistenceStore();
    const connector = createSitemapConnector({
      fetcher,
      propertyStore: new FakeSitemapPropertyStore(),
      persistenceStore: persistence
    });

    const result = await runConnectorSync({
      connection: {
        id: "ic_sitemap_3",
        workspaceId: "ws_1",
        propertyId: "prop_1",
        provider: "sitemap",
        credentialRef: null,
        freshnessSlaMinutes: 60,
        configJson: null
      },
      trigger: "manual",
      now: new Date("2026-04-01T04:00:00.000Z"),
      connector,
      credentialStore: new InMemoryCredentialStore(),
      persistence: new InMemorySyncPersistence(),
      retryPolicy: createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 })
    });

    expect(result.status).toBe("partial_failed");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        segment: "fetch:https://example.com/pages-b.xml",
        retryable: true
      })
    );
    expect(persistence.ingestedBatches[0]?.urls).toEqual([
      {
        rawUrl: "https://example.com/",
        normalizedUrlKey: "example.com",
        discoveredFrom: ["https://example.com/pages-a.xml"],
        lastmod: null,
        changefreq: null,
        priority: null
      }
    ]);
  });
});
