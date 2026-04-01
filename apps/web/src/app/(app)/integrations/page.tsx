"use client";

import { useMemo, useState } from "react";

import {
  classifyFreshness,
  formatRelativeMinutes,
  getCoverageSummary,
  getHealthSummary,
  type ConnectorStatus,
  type IntegrationConnector
} from "./page.logic";

const INITIAL_CONNECTORS: IntegrationConnector[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    system: "Analytics",
    status: "healthy",
    freshnessMinutes: 4,
    lastSyncMinutes: 4,
    coveragePercent: 98,
    hasError: false
  },
  {
    id: "search-console",
    name: "Google Search Console",
    system: "SEO",
    status: "warning",
    freshnessMinutes: 78,
    lastSyncMinutes: 78,
    coveragePercent: 84,
    hasError: true,
    errorCode: "TOKEN_REFRESH_REQUIRED",
    errorMessage:
      "OAuth token expired overnight. Data import paused until credentials are renewed."
  },
  {
    id: "webflow",
    name: "Webflow CMS",
    system: "Content",
    status: "healthy",
    freshnessMinutes: 11,
    lastSyncMinutes: 11,
    coveragePercent: 92,
    hasError: false
  },
  {
    id: "sentry",
    name: "Sentry",
    system: "Observability",
    status: "critical",
    freshnessMinutes: 186,
    lastSyncMinutes: 186,
    coveragePercent: 61,
    hasError: true,
    errorCode: "RATE_LIMIT_429",
    errorMessage:
      "Connector is being throttled by upstream API. Event ingestion dropped below healthy threshold."
  },
  {
    id: "shopify",
    name: "Shopify",
    system: "Commerce",
    status: "disconnected",
    freshnessMinutes: 3610,
    lastSyncMinutes: 3610,
    coveragePercent: 0,
    hasError: true,
    errorCode: "AUTH_REVOKED",
    errorMessage:
      "Store credentials were revoked. Reconnect required before next sync can run."
  },
  {
    id: "vercel",
    name: "Vercel",
    system: "Deployments",
    status: "healthy",
    freshnessMinutes: 34,
    lastSyncMinutes: 34,
    coveragePercent: 89,
    hasError: false
  }
];

const STATUS_LABELS: Record<ConnectorStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  disconnected: "Disconnected"
};

const FRESHNESS_LABELS = {
  fresh: "Fresh",
  aging: "Aging",
  stale: "Stale"
} as const;

function clearConnectorError(connector: IntegrationConnector) {
  const sanitized: IntegrationConnector = { ...connector };
  delete sanitized.errorCode;
  delete sanitized.errorMessage;
  return sanitized;
}

export default function IntegrationsPage() {
  const [connectors, setConnectors] = useState<IntegrationConnector[]>(INITIAL_CONNECTORS);
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  const [errorDrawerId, setErrorDrawerId] = useState<string | null>(null);

  const healthSummary = useMemo(() => getHealthSummary(connectors), [connectors]);
  const coverageSummary = useMemo(() => getCoverageSummary(connectors), [connectors]);

  const staleCount = connectors.filter(
    (connector) => classifyFreshness(connector.freshnessMinutes) === "stale"
  ).length;
  const oldestSyncMinutes = connectors.reduce(
    (maxMinutes, connector) => Math.max(maxMinutes, connector.lastSyncMinutes),
    0
  );

  const activeError = connectors.find((connector) => connector.id === errorDrawerId) ?? null;

  const handleSyncNow = (connectorId: string) => {
    if (syncingIds.includes(connectorId)) {
      return;
    }

    setSyncingIds((current) => [...current, connectorId]);

    setTimeout(() => {
      setConnectors((current) =>
        current.map((connector) => {
          if (connector.id !== connectorId) {
            return connector;
          }

          if (connector.status === "disconnected") {
            return connector;
          }

          return {
            ...clearConnectorError(connector),
            status: "healthy",
            hasError: false,
            freshnessMinutes: 1,
            lastSyncMinutes: 1,
            coveragePercent: Math.min(100, connector.coveragePercent + 2)
          };
        })
      );

      setSyncingIds((current) => current.filter((id) => id !== connectorId));
    }, 900);
  };

  const handleSyncMostStale = () => {
    const nextConnector = [...connectors]
      .filter((connector) => connector.status !== "disconnected")
      .sort((a, b) => b.freshnessMinutes - a.freshnessMinutes)[0];

    if (!nextConnector) {
      return;
    }

    handleSyncNow(nextConnector.id);
  };

  const handleReconnect = () => {
    if (!reconnectId) {
      return;
    }

    setConnectors((current) =>
      current.map((connector) =>
        connector.id === reconnectId
          ? {
              ...clearConnectorError(connector),
              status: "healthy",
              hasError: false,
              freshnessMinutes: 2,
              lastSyncMinutes: 2,
              coveragePercent: Math.max(70, connector.coveragePercent)
            }
          : connector
      )
    );

    if (errorDrawerId === reconnectId) {
      setErrorDrawerId(null);
    }

    setReconnectId(null);
  };

  return (
    <section className="surface-panel integrations-screen">
      <header className="integrations-screen__header">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Connector health at a glance</h1>
          <p className="integrations-screen__description">
            Scan status, freshness, and coverage in one pass so you can fix degraded
            connectors before they impact decision quality.
          </p>
        </div>

        <div className="integrations-screen__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={handleSyncMostStale}
          >
            Sync now
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setReconnectId(connectors.find((item) => item.status === "disconnected")?.id ?? null)}
          >
            Reconnect failed connector
          </button>
        </div>
      </header>

      <section className="integrations-scan-summary" aria-label="Connector health summary">
        <article className="metric-card integrations-scan-summary__card">
          <span>Critical</span>
          <strong>{healthSummary.critical + healthSummary.disconnected}</strong>
          <small>
            {healthSummary.critical} critical, {healthSummary.disconnected} disconnected
          </small>
        </article>

        <article className="metric-card integrations-scan-summary__card">
          <span>Warnings</span>
          <strong>{healthSummary.warning}</strong>
          <small>{healthSummary.withErrors} connectors with active errors</small>
        </article>

        <article className="metric-card integrations-scan-summary__card">
          <span>Freshness risk</span>
          <strong>{staleCount}</strong>
          <small>{formatRelativeMinutes(oldestSyncMinutes)} oldest sync</small>
        </article>

        <article className="metric-card integrations-scan-summary__card">
          <span>Coverage</span>
          <strong>{coverageSummary.avgCoveragePercent}%</strong>
          <small>
            {coverageSummary.connected}/{coverageSummary.total} connectors live
          </small>
        </article>
      </section>

      {reconnectId ? (
        <section className="integrations-reconnect" role="status" aria-live="polite">
          <div>
            <p className="eyebrow">Reconnect flow</p>
            <h2>
              Re-authorize {connectors.find((connector) => connector.id === reconnectId)?.name}
            </h2>
            <p>
              This restores credentials, resumes sync jobs, and resets freshness to the
              healthy window.
            </p>
          </div>
          <div className="integrations-reconnect__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setReconnectId(null)}
            >
              Cancel
            </button>
            <button type="button" className="button button--primary" onClick={handleReconnect}>
              Confirm reconnect
            </button>
          </div>
        </section>
      ) : null}

      <div className="integrations-grid" aria-label="Connector cards">
        {connectors.map((connector) => {
          const freshnessState = classifyFreshness(connector.freshnessMinutes);
          const isSyncing = syncingIds.includes(connector.id);
          const isDisconnected = connector.status === "disconnected";

          return (
            <article key={connector.id} className="integrations-card">
              <div className="integrations-card__head">
                <div>
                  <h2>{connector.name}</h2>
                  <p>{connector.system}</p>
                </div>
                <div className="integrations-card__badges">
                  <span className={`status-badge status-badge--${connector.status}`}>
                    {STATUS_LABELS[connector.status]}
                  </span>
                  <span className={`freshness-badge freshness-badge--${freshnessState}`}>
                    {FRESHNESS_LABELS[freshnessState]}
                  </span>
                </div>
              </div>

              <dl className="integrations-card__meta">
                <div>
                  <dt>Last sync</dt>
                  <dd>{formatRelativeMinutes(connector.lastSyncMinutes)}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{connector.coveragePercent}%</dd>
                </div>
              </dl>

              <div className="integrations-card__coverage" aria-hidden="true">
                <span style={{ width: `${connector.coveragePercent}%` }} />
              </div>

              <div className="integrations-card__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={isSyncing || isDisconnected}
                  onClick={() => handleSyncNow(connector.id)}
                >
                  {isSyncing ? "Syncing..." : "Sync now"}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setReconnectId(connector.id)}
                  disabled={connector.status === "healthy"}
                >
                  Reconnect
                </button>
                {connector.hasError ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setErrorDrawerId(connector.id)}
                  >
                    View error
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <aside
        className={`integrations-error-drawer${activeError ? " integrations-error-drawer--open" : ""}`}
        aria-label="Integration error drawer"
      >
        <div className="integrations-error-drawer__header">
          <div>
            <p className="eyebrow">Error details</p>
            <h2>{activeError?.name ?? "No connector selected"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setErrorDrawerId(null)}
            aria-label="Close error drawer"
          >
            X
          </button>
        </div>

        {activeError ? (
          <div className="integrations-error-drawer__body">
            <p className="integrations-error-drawer__code">{activeError.errorCode ?? "UNKNOWN_ERROR"}</p>
            <p>{activeError.errorMessage ?? "No additional diagnostic details."}</p>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABELS[activeError.status]}</dd>
              </div>
              <div>
                <dt>Last sync</dt>
                <dd>{formatRelativeMinutes(activeError.lastSyncMinutes)}</dd>
              </div>
              <div>
                <dt>Freshness</dt>
                <dd>{FRESHNESS_LABELS[classifyFreshness(activeError.freshnessMinutes)]}</dd>
              </div>
            </dl>
            <div className="integrations-error-drawer__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => handleSyncNow(activeError.id)}
                disabled={activeError.status === "disconnected" || syncingIds.includes(activeError.id)}
              >
                Sync now
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => setReconnectId(activeError.id)}
              >
                Reconnect
              </button>
            </div>
          </div>
        ) : (
          <p className="integrations-error-drawer__empty">
            Select a connector with an error to inspect failure details and recovery steps.
          </p>
        )}
      </aside>
    </section>
  );
}
