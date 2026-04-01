import { EmptyState } from "../../../components/empty-state";

export default function IntegrationsPage() {
  return (
    <EmptyState
      eyebrow="Integrations"
      title="Connect the systems that power your WebOps decisions"
      description="Bring in analytics, CMS, experimentation, deployment, and alerting tools so the workspace becomes the operational source of truth."
      primaryAction="Add integration"
      secondaryAction="View API contracts"
      stats={[
        { label: "Connected tools", value: "0 live" },
        { label: "Pending auth", value: "2 queues" },
        { label: "Sync cadence", value: "15 min" }
      ]}
    />
  );
}
