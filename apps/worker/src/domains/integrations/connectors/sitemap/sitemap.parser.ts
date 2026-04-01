export interface ParsedSitemapIndex {
  kind: "index";
  childSitemapUrls: string[];
}

export interface ParsedSitemapUrlEntry {
  rawUrl: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

export interface ParsedSitemapUrlSet {
  kind: "urlset";
  urls: ParsedSitemapUrlEntry[];
}

export type ParsedSitemapDocument = ParsedSitemapIndex | ParsedSitemapUrlSet;

function decodeXmlText(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function readTagValue(block: string, tagName: string): string | null {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  if (!match?.[1]) {
    return null;
  }

  return decodeXmlText(match[1].trim());
}

function parseIsoDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseSitemapXml(xml: string): ParsedSitemapDocument | null {
  if (/<sitemapindex\b/i.test(xml)) {
    const childSitemapUrls = [...xml.matchAll(/<sitemap\b[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi)]
      .map((match) => match[1]?.trim() ?? "")
      .filter((value) => value.length > 0)
      .map((value) => decodeXmlText(value))
      .filter((value) => value.length > 0);

    return {
      kind: "index",
      childSitemapUrls
    };
  }

  if (/<urlset\b/i.test(xml)) {
    const urls = [...xml.matchAll(/<url\b[\s\S]*?>([\s\S]*?)<\/url>/gi)]
      .map((match) => match[1] ?? "")
      .map((block) => {
        const rawUrl = readTagValue(block, "loc");
        if (!rawUrl) {
          return null;
        }

        const priorityValue = readTagValue(block, "priority");
        const parsedPriority =
          priorityValue === null ? null : Number.parseFloat(priorityValue);

        return {
          rawUrl,
          lastmod: parseIsoDate(readTagValue(block, "lastmod")),
          changefreq: readTagValue(block, "changefreq"),
          priority: Number.isFinite(parsedPriority) ? parsedPriority : null
        } satisfies ParsedSitemapUrlEntry;
      })
      .filter((entry): entry is ParsedSitemapUrlEntry => entry !== null);

    return {
      kind: "urlset",
      urls
    };
  }

  return null;
}
