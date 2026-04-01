import { EmptyState } from "../../../components/empty-state";

export default function ReportsPage() {
  return (
    <EmptyState
      eyebrow="Reports"
      title="Package operational evidence into stakeholder-ready reporting"
      description="Build recurring reports that explain performance, changes, risks, and follow-up actions without rebuilding decks every cycle."
      primaryAction="Create report template"
      secondaryAction="Select reporting cadence"
      stats={[
        { label: "Scheduled reports", value: "0 active" },
        { label: "Recipients", value: "14 ready" },
        { label: "Freshness SLA", value: "<24h" }
      ]}
    />
  );
}
