import { EmptyState } from "../../../components/empty-state";

export default function AlertsPage() {
  return (
    <EmptyState
      eyebrow="Alerts"
      title="See the incidents that need intervention before they spread"
      description="Aggregate publishing failures, data anomalies, SEO regressions, and policy breaches into one escalation surface."
      primaryAction="Configure alerts"
      secondaryAction="Review escalation matrix"
      stats={[
        { label: "Open alerts", value: "0 active" },
        { label: "Median response", value: "14m" },
        { label: "Critical policies", value: "6 monitored" }
      ]}
    >
      <ul>
        <li>Trigger alerts from crawl health, analytics drift, and deployment risk.</li>
        <li>Route ownership to the right workspace team before issues go stale.</li>
        <li>Keep alert copy short, specific, and action-oriented.</li>
      </ul>
    </EmptyState>
  );
}
