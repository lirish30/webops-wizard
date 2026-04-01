import { isSamePropertyDomain } from "./crawler.rules";

export interface ExtractedPageSnapshot {
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalTargetUrl: string | null;
  internalLinkCount: number;
  discoveredInternalUrls: string[];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTagText(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  if (!match?.[1]) {
    return null;
  }

  const text = collapseWhitespace(match[1].replace(/<[^>]+>/g, ""));
  return text.length > 0 ? text : null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );

  if (!match?.[1]) {
    return null;
  }

  const description = collapseWhitespace(match[1]);
  return description.length > 0 ? description : null;
}

function extractCanonical(html: string, baseUrl: string): string | null {
  const match = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    const resolved = new URL(match[1], baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

function extractInternalUrls(input: {
  html: string;
  baseUrl: string;
  primaryDomain: string;
}): string[] {
  const hrefPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const discovered: string[] = [];
  const seen = new Set<string>();

  for (const match of input.html.matchAll(hrefPattern)) {
    const href = match[1];
    if (!href) {
      continue;
    }

    try {
      const resolved = new URL(href, input.baseUrl);
      if (!["http:", "https:"].includes(resolved.protocol)) {
        continue;
      }

      if (!isSamePropertyDomain(resolved.toString(), input.primaryDomain)) {
        continue;
      }

      resolved.hash = "";
      if (seen.has(resolved.toString())) {
        continue;
      }

      seen.add(resolved.toString());
      discovered.push(resolved.toString());
    } catch {
      continue;
    }
  }

  return discovered;
}

export function extractPageSnapshot(input: {
  html: string;
  baseUrl: string;
  primaryDomain: string;
}): ExtractedPageSnapshot {
  const title = extractTagText(input.html, "title");
  const discoveredInternalUrls = extractInternalUrls(input);

  return {
    title,
    metaTitle: title,
    metaDescription: extractMetaDescription(input.html),
    h1: extractTagText(input.html, "h1"),
    canonicalTargetUrl: extractCanonical(input.html, input.baseUrl),
    internalLinkCount: discoveredInternalUrls.length,
    discoveredInternalUrls
  };
}
