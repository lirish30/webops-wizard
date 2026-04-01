export type ConnectorStatus = "healthy" | "warning" | "critical" | "disconnected";

export type FreshnessState = "fresh" | "aging" | "stale";

export type IntegrationConnector = {
  id: string;
  name: string;
  system: string;
  status: ConnectorStatus;
  freshnessMinutes: number;
  lastSyncMinutes: number;
  coveragePercent: number;
  hasError: boolean;
  errorMessage?: string;
  errorCode?: string;
};

export type CoverageSummary = {
  connected: number;
  total: number;
  avgCoveragePercent: number;
};

export type HealthSummary = {
  healthy: number;
  warning: number;
  critical: number;
  disconnected: number;
  withErrors: number;
};

export function classifyFreshness(minutes: number): FreshnessState {
  if (minutes <= 15) {
    return "fresh";
  }

  if (minutes <= 120) {
    return "aging";
  }

  return "stale";
}

export function formatRelativeMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(0, Math.floor(minutes))}m ago`;
  }

  if (minutes < 1440) {
    return `${Math.floor(minutes / 60)}h ago`;
  }

  return `${Math.floor(minutes / 1440)}d ago`;
}

export function getCoverageSummary(connectors: IntegrationConnector[]): CoverageSummary {
  const total = connectors.length;
  const connected = connectors.filter((connector) => connector.status !== "disconnected").length;

  if (total === 0) {
    return {
      connected,
      total,
      avgCoveragePercent: 0
    };
  }

  const sumCoverage = connectors.reduce((sum, connector) => sum + connector.coveragePercent, 0);

  return {
    connected,
    total,
    avgCoveragePercent: Math.round(sumCoverage / total)
  };
}

export function getHealthSummary(connectors: IntegrationConnector[]): HealthSummary {
  return connectors.reduce<HealthSummary>(
    (summary, connector) => {
      summary[connector.status] += 1;

      if (connector.hasError) {
        summary.withErrors += 1;
      }

      return summary;
    },
    {
      healthy: 0,
      warning: 0,
      critical: 0,
      disconnected: 0,
      withErrors: 0
    }
  );
}
