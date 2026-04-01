import type { ReactNode } from "react";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  stats: Array<{ label: string; value: string }>;
  children?: ReactNode;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  stats,
  children
}: EmptyStateProps) {
  return (
    <section className="surface-panel empty-state">
      <div className="empty-state__hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="empty-state__description">{description}</p>
        </div>
        <div className="empty-state__actions" role="group" aria-label={`${title} actions`}>
          <button type="button" className="button button--primary">
            {primaryAction}
          </button>
          <button type="button" className="button button--secondary">
            {secondaryAction}
          </button>
        </div>
      </div>

      <div className="empty-state__stats" aria-label={`${title} summary metrics`}>
        {stats.map((stat) => (
          <article key={stat.label} className="metric-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="empty-state__canvas">
        <div className="empty-state__blueprint" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="empty-state__content">
          <h2>Nothing live here yet</h2>
          <p>
            Connect this workspace surface to real WebOps signals, then use the shell
            actions above as the first operational path.
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
