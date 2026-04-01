import {
  isSamePropertyDomain,
  normalizeCrawlerUrlKey,
  passesIncludeExcludeRules
} from "./crawler.rules";

export interface CrawlerSeed {
  rawUrl: string;
  normalizedUrlKey: string;
  depth: number;
}

interface KnownUrlRecord {
  rawUrl: string;
  normalizedUrlKey: string;
}

function toSeed(
  rawUrl: string,
  primaryDomain: string,
  includeRules: string[],
  excludeRules: string[]
): CrawlerSeed | null {
  try {
    if (!isSamePropertyDomain(rawUrl, primaryDomain)) {
      return null;
    }

    if (
      !passesIncludeExcludeRules({
        url: rawUrl,
        includeRules,
        excludeRules
      })
    ) {
      return null;
    }

    return {
      rawUrl,
      normalizedUrlKey: normalizeCrawlerUrlKey(rawUrl),
      depth: 0
    };
  } catch {
    return null;
  }
}

function appendSeeds(
  target: Map<string, CrawlerSeed>,
  records: Iterable<string>,
  primaryDomain: string,
  includeRules: string[],
  excludeRules: string[]
) {
  for (const rawUrl of records) {
    const seed = toSeed(rawUrl, primaryDomain, includeRules, excludeRules);
    if (!seed || target.has(seed.normalizedUrlKey)) {
      continue;
    }

    target.set(seed.normalizedUrlKey, seed);
  }
}

export function buildCrawlerSeeds(input: {
  sitemapUrlRecords: KnownUrlRecord[];
  fallbackUrlRecords: KnownUrlRecord[];
  seedUrls: string[];
  includeRules: string[];
  excludeRules: string[];
  primaryDomain: string;
}): CrawlerSeed[] {
  const byKey = new Map<string, CrawlerSeed>();

  appendSeeds(
    byKey,
    input.seedUrls,
    input.primaryDomain,
    input.includeRules,
    input.excludeRules
  );

  const preferredRecords =
    input.sitemapUrlRecords.length > 0 ? input.sitemapUrlRecords : input.fallbackUrlRecords;

  appendSeeds(
    byKey,
    preferredRecords.map((record) => record.rawUrl),
    input.primaryDomain,
    input.includeRules,
    input.excludeRules
  );

  return [...byKey.values()];
}
