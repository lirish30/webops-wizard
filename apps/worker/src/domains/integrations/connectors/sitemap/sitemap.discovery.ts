export interface SitemapDiscoveryInput {
  primaryDomain: string;
  configuredSitemapUrl?: string | null;
  fetchText: (url: string) => Promise<string>;
}

export interface SitemapDiscoveryResult {
  candidates: string[];
  robotsFetched: boolean;
}

function toPrimaryOrigin(primaryDomain: string): string {
  const value = primaryDomain.trim();

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return new URL(value).origin;
  }

  return new URL(`https://${value}`).origin;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    result.push(url);
  }

  return result;
}

function parseRobotsSitemaps(robotsText: string): string[] {
  return robotsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim())
    .filter((line) => line.length > 0);
}

export async function discoverSitemapCandidates(
  input: SitemapDiscoveryInput
): Promise<SitemapDiscoveryResult> {
  const origin = toPrimaryOrigin(input.primaryDomain);
  const candidates: string[] = [];

  if (input.configuredSitemapUrl) {
    candidates.push(input.configuredSitemapUrl);
  }

  candidates.push(new URL("/sitemap.xml", origin).toString());

  const robotsUrl = new URL("/robots.txt", origin).toString();
  const robotsText = await input.fetchText(robotsUrl);

  candidates.push(...parseRobotsSitemaps(robotsText));

  return {
    candidates: uniqueUrls(candidates),
    robotsFetched: true
  };
}

export function buildPrimarySitemapCandidates(input: {
  primaryDomain: string;
  configuredSitemapUrl?: string | null;
}): string[] {
  const origin = toPrimaryOrigin(input.primaryDomain);
  const candidates: string[] = [];

  if (input.configuredSitemapUrl) {
    candidates.push(input.configuredSitemapUrl);
  }

  candidates.push(new URL("/sitemap.xml", origin).toString());

  return uniqueUrls(candidates);
}

export function buildRobotsUrl(primaryDomain: string): string {
  return new URL("/robots.txt", toPrimaryOrigin(primaryDomain)).toString();
}
