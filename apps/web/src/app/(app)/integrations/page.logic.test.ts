import { describe, expect, it } from "vitest";

import {
  classifyFreshness,
  formatRelativeMinutes,
  getCoverageSummary,
  getHealthSummary,
  type IntegrationConnector
} from "./page.logic";

const CONNECTORS: IntegrationConnector[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    system: "Analytics",
    status: "healthy",
    freshnessMinutes: 6,
    lastSyncMinutes: 6,
    coveragePercent: 96,
    hasError: false
  },
  {
    id: "search-console",
    name: "Google Search Console",
    system: "SEO",
    status: "warning",
    freshnessMinutes: 72,
    lastSyncMinutes: 72,
    coveragePercent: 82,
    hasError: true
  },
  {
    id: "shopify",
    name: "Shopify",
    system: "Commerce",
    status: "disconnected",
    freshnessMinutes: 1660,
    lastSyncMinutes: 1660,
    coveragePercent: 0,
    hasError: true
  }
];

describe("integrations page logic", () => {
  it("classifies freshness windows for badges", () => {
    expect(classifyFreshness(8)).toBe("fresh");
    expect(classifyFreshness(45)).toBe("aging");
    expect(classifyFreshness(180)).toBe("stale");
  });

  it("formats relative sync timestamps in scan-friendly text", () => {
    expect(formatRelativeMinutes(3)).toBe("3m ago");
    expect(formatRelativeMinutes(90)).toBe("1h ago");
    expect(formatRelativeMinutes(2880)).toBe("2d ago");
  });

  it("builds a coverage summary from connector records", () => {
    expect(getCoverageSummary(CONNECTORS)).toEqual({
      connected: 2,
      total: 3,
      avgCoveragePercent: 59
    });
  });

  it("surfaces a health summary for top-of-screen scan", () => {
    expect(getHealthSummary(CONNECTORS)).toEqual({
      healthy: 1,
      warning: 1,
      critical: 0,
      disconnected: 1,
      withErrors: 2
    });
  });
});
