import { EmptyState } from "../../../components/empty-state";

export default function ExperimentsPage() {
  return (
    <EmptyState
      eyebrow="Experiments"
      title="Turn release ideas into governed experiments"
      description="Collect hypotheses, route approvals, and measure outcomes with a clear line from change request to business impact."
      primaryAction="Create experiment brief"
      secondaryAction="View rollout rules"
      stats={[
        { label: "Experiments running", value: "0 active" },
        { label: "Average decision time", value: "5 days" },
        { label: "Evidence completeness", value: "72%" }
      ]}
    />
  );
}
