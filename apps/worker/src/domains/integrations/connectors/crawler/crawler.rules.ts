function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

export function normalizeCrawlerUrlKey(urlString: string): string {
  const parsed = new URL(urlString);
  const pathname = normalizePathname(parsed.pathname);
  return pathname === "/" ? parsed.hostname.toLowerCase() : `${parsed.hostname}${pathname}`.toLowerCase();
}

export function isSamePropertyDomain(urlString: string, primaryDomain: string): boolean {
  const hostname = new URL(urlString).hostname.toLowerCase();
  const normalizedDomain = primaryDomain.toLowerCase();

  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

export function matchesRule(urlString: string, rule: string): boolean {
  const parsed = new URL(urlString);
  return (
    parsed.pathname.includes(rule) ||
    parsed.href.includes(rule)
  );
}

export function passesIncludeExcludeRules(input: {
  url: string;
  includeRules: string[];
  excludeRules: string[];
}): boolean {
  const includeMatch =
    input.includeRules.length === 0 ||
    input.includeRules.some((rule) => matchesRule(input.url, rule));

  if (!includeMatch) {
    return false;
  }

  return !input.excludeRules.some((rule) => matchesRule(input.url, rule));
}
