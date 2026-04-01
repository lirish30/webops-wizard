import { createHash } from "node:crypto";

import { prisma } from "@webops-wizard/db";

import type { ExtractedPageSnapshot } from "./crawler.extract";

export interface CrawlerPersistenceStore {
  upsertSnapshot(input: {
    propertyId: string;
    normalizedUrlKey: string;
    canonicalUrl: string;
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    fetchMode: "html";
    crawlDepth: number;
    extracted: ExtractedPageSnapshot | null;
    snapshotHtml: string | null;
    snapshotDate: Date;
    discoveredAt: Date;
  }): Promise<void>;
  recordDiscoveredUrls(input: {
    propertyId: string;
    urls: Array<{
      rawUrl: string;
      normalizedUrlKey: string;
      source: "crawler";
      discoveredAt: Date;
    }>;
  }): Promise<void>;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildContentHash(html: string | null): string | null {
  if (!html) {
    return null;
  }

  return createHash("sha256").update(html).digest("hex");
}

export class PrismaCrawlerPersistenceStore implements CrawlerPersistenceStore {
  async upsertSnapshot(input: {
    propertyId: string;
    normalizedUrlKey: string;
    canonicalUrl: string;
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    fetchMode: "html";
    crawlDepth: number;
    extracted: ExtractedPageSnapshot | null;
    snapshotHtml: string | null;
    snapshotDate: Date;
    discoveredAt: Date;
  }) {
    let canonicalPage = await prisma.canonicalPage.findUnique({
      where: {
        propertyId_normalizedUrlKey: {
          propertyId: input.propertyId,
          normalizedUrlKey: input.normalizedUrlKey
        }
      },
      select: {
        id: true
      }
    });

    if (!canonicalPage) {
      canonicalPage = await prisma.canonicalPage.create({
        data: {
          propertyId: input.propertyId,
          canonicalUrl: input.canonicalUrl,
          normalizedUrlKey: input.normalizedUrlKey,
          firstSeenAt: input.discoveredAt,
          lastSeenAt: input.discoveredAt,
          ...(input.extracted
            ? {
                title: input.extracted.title,
                metaTitle: input.extracted.metaTitle,
                metaDescription: input.extracted.metaDescription,
                h1: input.extracted.h1,
                canonicalTargetUrl: input.extracted.canonicalTargetUrl
              }
            : {})
        },
        select: {
          id: true
        }
      });
    } else {
      await prisma.canonicalPage.update({
        where: { id: canonicalPage.id },
        data: {
          canonicalUrl: input.finalUrl,
          lastSeenAt: input.discoveredAt,
          ...(input.extracted
            ? {
                title: input.extracted.title,
                metaTitle: input.extracted.metaTitle,
                metaDescription: input.extracted.metaDescription,
                h1: input.extracted.h1,
                canonicalTargetUrl: input.extracted.canonicalTargetUrl
              }
            : {})
        }
      });
    }

    await prisma.urlRecord.upsert({
      where: {
        propertyId_normalizedUrlKey: {
          propertyId: input.propertyId,
          normalizedUrlKey: input.normalizedUrlKey
        }
      },
      update: {
        canonicalPageId: canonicalPage.id,
        rawUrl: input.finalUrl,
        lastSeenAt: input.discoveredAt,
        source: "crawler"
      },
      create: {
        propertyId: input.propertyId,
        canonicalPageId: canonicalPage.id,
        rawUrl: input.finalUrl,
        normalizedUrlKey: input.normalizedUrlKey,
        isCurrentAlias: true,
        firstSeenAt: input.discoveredAt,
        lastSeenAt: input.discoveredAt,
        source: "crawler"
      }
    });

    const updateData = {
      contentHash: buildContentHash(input.snapshotHtml),
      crawlDepth: input.crawlDepth,
      statusCode: input.statusCode,
      snapshotHtml: input.snapshotHtml,
      fetchMode: input.fetchMode,
      requestedUrl: input.requestedUrl,
      finalUrl: input.finalUrl,
      ...(input.extracted
        ? {
            title: input.extracted.title,
            metaTitle: input.extracted.metaTitle,
            metaDescription: input.extracted.metaDescription,
            h1: input.extracted.h1,
            internalLinkCount: input.extracted.internalLinkCount
          }
        : {})
    };

    const createData = {
      canonicalPageId: canonicalPage.id,
      snapshotDate: startOfUtcDay(input.snapshotDate),
      title: input.extracted?.title ?? null,
      metaTitle: input.extracted?.metaTitle ?? null,
      metaDescription: input.extracted?.metaDescription ?? null,
      h1: input.extracted?.h1 ?? null,
      contentHash: buildContentHash(input.snapshotHtml),
      internalLinkCount: input.extracted?.internalLinkCount ?? null,
      crawlDepth: input.crawlDepth,
      statusCode: input.statusCode,
      snapshotHtml: input.snapshotHtml,
      fetchMode: input.fetchMode,
      requestedUrl: input.requestedUrl,
      finalUrl: input.finalUrl
    };

    await prisma.pageStateSnapshot.upsert({
      where: {
        canonicalPageId_snapshotDate: {
          canonicalPageId: canonicalPage.id,
          snapshotDate: startOfUtcDay(input.snapshotDate)
        }
      },
      update: updateData,
      create: createData
    });
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
    for (const url of input.urls) {
      let canonicalPage = await prisma.canonicalPage.findUnique({
        where: {
          propertyId_normalizedUrlKey: {
            propertyId: input.propertyId,
            normalizedUrlKey: url.normalizedUrlKey
          }
        },
        select: {
          id: true
        }
      });

      if (!canonicalPage) {
        canonicalPage = await prisma.canonicalPage.create({
          data: {
            propertyId: input.propertyId,
            canonicalUrl: url.rawUrl,
            normalizedUrlKey: url.normalizedUrlKey,
            firstSeenAt: url.discoveredAt,
            lastSeenAt: url.discoveredAt
          },
          select: {
            id: true
          }
        });
      }

      await prisma.urlRecord.upsert({
        where: {
          propertyId_normalizedUrlKey: {
            propertyId: input.propertyId,
            normalizedUrlKey: url.normalizedUrlKey
          }
        },
        update: {
          canonicalPageId: canonicalPage.id,
          lastSeenAt: url.discoveredAt,
          source: url.source
        },
        create: {
          propertyId: input.propertyId,
          canonicalPageId: canonicalPage.id,
          rawUrl: url.rawUrl,
          normalizedUrlKey: url.normalizedUrlKey,
          isCurrentAlias: true,
          firstSeenAt: url.discoveredAt,
          lastSeenAt: url.discoveredAt,
          source: url.source
        }
      });
    }
  }
}
