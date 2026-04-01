import { Prisma } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

import type { DiscoveredSitemapUrl, SitemapPersistenceStore } from "./sitemap.connector";

function toJson(value: object): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isValidUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export class PrismaSitemapPersistenceStore implements SitemapPersistenceStore {
  async ingest(input: {
    propertyId: string;
    discoveredAt: Date;
    urls: DiscoveredSitemapUrl[];
  }): Promise<{ recordsSynced: number }> {
    if (input.urls.length === 0) {
      return { recordsSynced: 0 };
    }

    const normalizedUrlKeys = input.urls.map((url) => url.normalizedUrlKey);
    const [existingPages, existingUrlRecords] = await Promise.all([
      prisma.canonicalPage.findMany({
        where: {
          propertyId: input.propertyId,
          normalizedUrlKey: { in: normalizedUrlKeys }
        },
        select: {
          id: true,
          normalizedUrlKey: true
        }
      }),
      prisma.urlRecord.findMany({
        where: {
          propertyId: input.propertyId,
          normalizedUrlKey: { in: normalizedUrlKeys }
        },
        select: {
          canonicalPageId: true,
          normalizedUrlKey: true,
          rawUrl: true,
          firstSeenAt: true
        }
      })
    ]);

    const pageIdsByKey = new Map(
      existingPages.map((page) => [page.normalizedUrlKey, page.id])
    );
    const existingUrlRecordsByKey = new Map(
      existingUrlRecords.map((urlRecord) => [urlRecord.normalizedUrlKey, urlRecord])
    );

    for (const url of input.urls) {
      let canonicalPageId = pageIdsByKey.get(url.normalizedUrlKey);

      if (!canonicalPageId) {
        const created = await prisma.canonicalPage.create({
          data: {
            propertyId: input.propertyId,
            canonicalUrl: url.rawUrl,
            normalizedUrlKey: url.normalizedUrlKey,
            firstSeenAt: input.discoveredAt,
            lastSeenAt: input.discoveredAt
          },
          select: {
            id: true
          }
        });

        canonicalPageId = created.id;
        pageIdsByKey.set(url.normalizedUrlKey, canonicalPageId);
      } else {
        await prisma.canonicalPage.update({
          where: { id: canonicalPageId },
          data: {
            lastSeenAt: input.discoveredAt
          }
        });
      }

      const existingUrlRecord = existingUrlRecordsByKey.get(url.normalizedUrlKey);
      const metadataJson = {
        provider: "sitemap",
        discoveredFrom: url.discoveredFrom,
        lastmod: url.lastmod,
        changefreq: url.changefreq,
        priority: url.priority
      };

      await prisma.urlRecord.upsert({
        where: {
          propertyId_normalizedUrlKey: {
            propertyId: input.propertyId,
            normalizedUrlKey: url.normalizedUrlKey
          }
        },
        update: {
          canonicalPageId,
          rawUrl: isValidUrl(existingUrlRecord?.rawUrl)
            ? existingUrlRecord?.rawUrl ?? url.rawUrl
            : url.rawUrl,
          isCurrentAlias: true,
          lastSeenAt: input.discoveredAt,
          source: "sitemap",
          metadataJson: toJson(metadataJson)
        },
        create: {
          propertyId: input.propertyId,
          canonicalPageId,
          rawUrl: url.rawUrl,
          normalizedUrlKey: url.normalizedUrlKey,
          isCurrentAlias: true,
          firstSeenAt: existingUrlRecord?.firstSeenAt ?? input.discoveredAt,
          lastSeenAt: input.discoveredAt,
          source: "sitemap",
          metadataJson: toJson(metadataJson)
        }
      });
    }

    return {
      recordsSynced: input.urls.length
    };
  }
}
