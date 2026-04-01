import type { ConnectorSyncSegmentResult } from "../connector.types";

import { parseSitemapXml } from "./sitemap.parser";

export interface TraversedSitemapUrl {
  rawUrl: string;
  normalizedUrlKey: string;
  discoveredFrom: string[];
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

export interface TraverseSitemapsInput {
  initialSitemapUrls: string[];
  fetchText: (url: string) => Promise<string>;
  maxSitemapsPerRun?: number;
  maxUrlsPerRun?: number;
}

export interface TraverseSitemapsResult {
  urls: TraversedSitemapUrl[];
  segments: ConnectorSyncSegmentResult[];
  latestDataAt: Date | null;
}

const DEFAULT_MAX_SITEMAPS_PER_RUN = 50;
const DEFAULT_MAX_URLS_PER_RUN = 5000;

function normalizeUrlKey(urlString: string): string {
  const parsed = new URL(urlString);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${pathname}`.toLowerCase() || parsed.hostname.toLowerCase();
}

function mergeLatestIsoDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export async function traverseSitemaps(
  input: TraverseSitemapsInput
): Promise<TraverseSitemapsResult> {
  const maxSitemapsPerRun = input.maxSitemapsPerRun ?? DEFAULT_MAX_SITEMAPS_PER_RUN;
  const maxUrlsPerRun = input.maxUrlsPerRun ?? DEFAULT_MAX_URLS_PER_RUN;
  const queue = [...input.initialSitemapUrls];
  const seenSitemapUrls = new Set<string>();
  const segments: ConnectorSyncSegmentResult[] = [];
  const urlsByKey = new Map<string, TraversedSitemapUrl>();

  while (queue.length > 0 && seenSitemapUrls.size < maxSitemapsPerRun) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemapUrls.has(sitemapUrl)) {
      continue;
    }

    seenSitemapUrls.add(sitemapUrl);

    let xml: string;
    try {
      xml = await input.fetchText(sitemapUrl);
      segments.push({
        segment: `fetch:${sitemapUrl}`,
        status: "success"
      });
    } catch (error) {
      segments.push({
        segment: `fetch:${sitemapUrl}`,
        status: "failed",
        code: "SITEMAP_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch sitemap",
        retryable: true
      });
      continue;
    }

    const parsed = parseSitemapXml(xml);
    if (!parsed) {
      segments.push({
        segment: `parse:${sitemapUrl}`,
        status: "failed",
        code: "INVALID_SITEMAP_XML",
        message: `Unsupported sitemap document at ${sitemapUrl}`,
        retryable: false
      });
      continue;
    }

    segments.push({
      segment: `parse:${sitemapUrl}`,
      status: "success"
    });

    if (parsed.kind === "index") {
      for (const childSitemapUrl of parsed.childSitemapUrls) {
        if (!seenSitemapUrls.has(childSitemapUrl)) {
          queue.push(childSitemapUrl);
        }
      }

      continue;
    }

    for (const entry of parsed.urls) {
      if (urlsByKey.size >= maxUrlsPerRun) {
        break;
      }

      let normalizedUrlKey: string;
      try {
        normalizedUrlKey = normalizeUrlKey(entry.rawUrl);
      } catch {
        segments.push({
          segment: `url:${sitemapUrl}`,
          status: "failed",
          code: "INVALID_URL",
          message: `Invalid URL in sitemap: ${entry.rawUrl}`,
          retryable: false
        });
        continue;
      }

      const existing = urlsByKey.get(normalizedUrlKey);
      if (!existing) {
        urlsByKey.set(normalizedUrlKey, {
          rawUrl: entry.rawUrl,
          normalizedUrlKey,
          discoveredFrom: [sitemapUrl],
          lastmod: entry.lastmod,
          changefreq: entry.changefreq,
          priority: entry.priority
        });
        continue;
      }

      existing.discoveredFrom = [...new Set([...existing.discoveredFrom, sitemapUrl])];
      existing.lastmod = mergeLatestIsoDate(existing.lastmod, entry.lastmod);
      existing.changefreq = existing.changefreq ?? entry.changefreq;
      existing.priority = existing.priority ?? entry.priority;
    }
  }

  let latestDataAt: Date | null = null;
  for (const url of urlsByKey.values()) {
    if (!url.lastmod) {
      continue;
    }

    const parsed = new Date(url.lastmod);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    if (!latestDataAt || parsed.getTime() > latestDataAt.getTime()) {
      latestDataAt = parsed;
    }
  }

  return {
    urls: [...urlsByKey.values()],
    segments,
    latestDataAt
  };
}
